"""Quality and pose gates for MediaPipe face landmarks."""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


MIN_FACE_WIDTH_PX = 180
MIN_FACE_HEIGHT_PX = 220


@dataclass(frozen=True)
class FaceQualityReport:
    accepted: bool
    reasons: list[str]
    warnings: list[str]
    metrics: dict[str, float]

    def to_dict(self) -> dict:
        return {
            "accepted": self.accepted,
            "reasons": self.reasons,
            "warnings": self.warnings,
            "metrics": self.metrics,
        }


def _distance(point_a: np.ndarray, point_b: np.ndarray) -> float:
    return float(np.linalg.norm(point_a - point_b))


def _image_metrics(image: np.ndarray) -> dict[str, float]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    luminance = gray.astype(np.float32)

    return {
        "mean_luminance": float(np.mean(luminance)),
        "contrast": float(np.std(luminance)),
        "dark_ratio": float(np.mean(luminance < 35)),
        "bright_ratio": float(np.mean(luminance > 245)),
        "sharpness": float(cv2.Laplacian(gray, cv2.CV_64F).var()),
    }


def _landmark_points(landmark_payload: dict) -> tuple[np.ndarray, np.ndarray]:
    landmarks = landmark_payload.get("landmarks", [])
    xy = np.array([[point["x"], point["y"]] for point in landmarks], dtype=np.float32)
    pixel_xy = np.array(
        [[point["pixel_x"], point["pixel_y"]] for point in landmarks],
        dtype=np.float32,
    )
    return xy, pixel_xy


def evaluate_face_quality(image: np.ndarray, landmark_payload: dict) -> FaceQualityReport:
    """
    Reject images that are too low quality or too far from a frontal face.

    MediaPipe Face Mesh can return landmarks for a side profile, but the downstream
    structure comparison assumes a mostly frontal portrait. Yaw rejection therefore
    uses several weak signals together instead of trusting one noisy measurement.
    """
    reasons: list[str] = []
    warnings: list[str] = []
    metrics = _image_metrics(image)

    xy, pixel_xy = _landmark_points(landmark_payload)
    if len(xy) < 468:
        return FaceQualityReport(
            accepted=False,
            reasons=["A complete face mesh could not be detected. Use a clear front-facing face photo."],
            warnings=[],
            metrics=metrics,
        )

    height, width = image.shape[:2]
    x_min, y_min = np.min(xy, axis=0)
    x_max, y_max = np.max(xy, axis=0)
    face_width_px = float((x_max - x_min) * width)
    face_height_px = float((y_max - y_min) * height)
    metrics.update(
        {
            "face_width_px": face_width_px,
            "face_height_px": face_height_px,
            "face_area_ratio": float((x_max - x_min) * (y_max - y_min)),
        }
    )

    if face_width_px < MIN_FACE_WIDTH_PX or face_height_px < MIN_FACE_HEIGHT_PX:
        reasons.append(
            "Face is too small or low-resolution. Move closer to the camera or upload a sharper photo."
        )

    if metrics["mean_luminance"] < 32 or metrics["dark_ratio"] > 0.62:
        reasons.append("Image is too dark. Use brighter, even lighting on the whole face.")
    elif metrics["mean_luminance"] < 45:
        warnings.append("low_light")

    if metrics["bright_ratio"] > 0.45:
        reasons.append("Image is overexposed. Reduce glare and avoid strong light on one side of the face.")

    if metrics["contrast"] < 14:
        reasons.append("Image has too little contrast for reliable facial landmarks.")

    if metrics["sharpness"] < 18:
        reasons.append("Image is too blurry for reliable facial landmarks.")
    elif metrics["sharpness"] < 35:
        warnings.append("soft_focus")

    required_indices = [1, 33, 61, 133, 152, 263, 291, 362]
    if any(index >= len(xy) for index in required_indices):
        return FaceQualityReport(
            accepted=False,
            reasons=["Required face landmarks were missing. Use a clear front-facing face photo."],
            warnings=warnings,
            metrics=metrics,
        )

    nose = xy[1]
    left_outer_eye = xy[33]
    left_inner_eye = xy[133]
    right_inner_eye = xy[362]
    right_outer_eye = xy[263]
    left_mouth = xy[61]
    right_mouth = xy[291]

    left_eye_center = (left_outer_eye + left_inner_eye) / 2.0
    right_eye_center = (right_inner_eye + right_outer_eye) / 2.0
    eye_center = (left_eye_center + right_eye_center) / 2.0
    eye_vector = right_eye_center - left_eye_center
    interocular_distance = max(_distance(left_eye_center, right_eye_center), 1e-6)
    mouth_width = max(_distance(left_mouth, right_mouth), 1e-6)
    mouth_center = (left_mouth + right_mouth) / 2.0

    roll_degrees = float(np.degrees(np.arctan2(eye_vector[1], eye_vector[0])))
    nose_eye_offset = float(abs(nose[0] - eye_center[0]) / interocular_distance)
    nose_mouth_offset = float(abs(nose[0] - mouth_center[0]) / mouth_width)

    left_eye_width = _distance(left_outer_eye, left_inner_eye)
    right_eye_width = _distance(right_inner_eye, right_outer_eye)
    eye_width_ratio = min(left_eye_width, right_eye_width) / max(left_eye_width, right_eye_width, 1e-6)

    left_face_extent = abs(float(nose[0] - x_min))
    right_face_extent = abs(float(x_max - nose[0]))
    face_side_ratio = min(left_face_extent, right_face_extent) / max(left_face_extent, right_face_extent, 1e-6)

    metrics.update(
        {
            "roll_degrees": roll_degrees,
            "nose_eye_offset": nose_eye_offset,
            "nose_mouth_offset": nose_mouth_offset,
            "eye_width_ratio": float(eye_width_ratio),
            "face_side_ratio": float(face_side_ratio),
        }
    )

    if abs(roll_degrees) > 12:
        reasons.append("Face is tilted too much. Keep both eyes level with the camera.")
    elif abs(roll_degrees) > 8:
        warnings.append("face_roll")

    yaw_flags = [
        nose_eye_offset > 0.24,
        nose_mouth_offset > 0.34,
        eye_width_ratio < 0.58,
        face_side_ratio < 0.42,
    ]
    if sum(yaw_flags) >= 2 or nose_eye_offset > 0.34 or face_side_ratio < 0.32:
        reasons.append("Face is not front-facing enough. Use a straight-on photo, not a side view.")
    elif sum(yaw_flags) == 1:
        warnings.append("possible_yaw")

    return FaceQualityReport(
        accepted=len(reasons) == 0,
        reasons=reasons,
        warnings=warnings,
        metrics=metrics,
    )
