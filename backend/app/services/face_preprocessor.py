"""Image enhancement and face ROI preparation."""
from __future__ import annotations

import cv2
import numpy as np


PROCESSED_FACE_SIZE = (768, 960)  # width, height; matches the frontend 4:5 frame.
MAX_WORKING_SIDE = 1400


def _resize_max_side(image: np.ndarray, max_side: int = MAX_WORKING_SIDE) -> np.ndarray:
    height, width = image.shape[:2]
    longest_side = max(height, width)

    if longest_side <= max_side:
        return image

    scale = max_side / float(longest_side)
    return cv2.resize(
        image,
        (max(1, int(round(width * scale))), max(1, int(round(height * scale)))),
        interpolation=cv2.INTER_AREA,
    )


def resize_for_processing(image: np.ndarray) -> np.ndarray:
    """Resize to the working dimensions used by the preprocessing pipeline."""
    return _resize_max_side(image)


def _gray_world_white_balance(image: np.ndarray) -> np.ndarray:
    image_float = image.astype(np.float32)
    channel_means = image_float.reshape(-1, 3).mean(axis=0)
    global_mean = float(channel_means.mean())

    if global_mean <= 0:
        return image

    scales = global_mean / np.maximum(channel_means, 1.0)
    balanced = image_float * scales
    return np.clip(balanced, 0, 255).astype(np.uint8)


def _adaptive_gamma(image: np.ndarray, target_luminance: float = 0.52) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    luminance = max(float(np.mean(gray)) / 255.0, 0.03)
    gamma = np.log(target_luminance) / np.log(luminance)
    gamma = float(np.clip(gamma, 0.65, 1.35))

    if abs(gamma - 1.0) < 0.05:
        return image

    table = np.array(
        [((value / 255.0) ** gamma) * 255 for value in range(256)],
        dtype=np.uint8,
    )
    return cv2.LUT(image, table)


def enhance_image(image: np.ndarray) -> np.ndarray:
    """Improve lighting, contrast, and perceived detail without changing geometry."""
    working = _resize_max_side(image)
    working = _gray_world_white_balance(working)
    working = _adaptive_gamma(working)

    lab = cv2.cvtColor(working, cv2.COLOR_BGR2LAB)
    lightness, channel_a, channel_b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lightness = clahe.apply(lightness)
    working = cv2.cvtColor(cv2.merge((lightness, channel_a, channel_b)), cv2.COLOR_LAB2BGR)

    blurred = cv2.GaussianBlur(working, (0, 0), 1.1)
    sharpened = cv2.addWeighted(working, 1.35, blurred, -0.35, 0)
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def crop_face_roi(
    image: np.ndarray,
    landmark_payload: dict,
    output_size: tuple[int, int] = PROCESSED_FACE_SIZE,
) -> np.ndarray:
    """
    Crop a stable face region from MediaPipe landmarks and resize it for analysis/display.

    The crop intentionally includes more space above the landmark box because Face Mesh
    landmarks do not cover hair and only approximate the upper forehead.
    """
    landmarks = landmark_payload.get("landmarks", [])
    if not landmarks:
        return cv2.resize(image, output_size, interpolation=cv2.INTER_CUBIC)

    height, width = image.shape[:2]
    points = np.array(
        [[point["pixel_x"], point["pixel_y"]] for point in landmarks],
        dtype=np.float32,
    )
    x_min, y_min = np.min(points, axis=0)
    x_max, y_max = np.max(points, axis=0)

    face_width = max(float(x_max - x_min), 1.0)
    face_height = max(float(y_max - y_min), 1.0)

    crop_left = x_min - face_width * 0.28
    crop_right = x_max + face_width * 0.28
    crop_top = y_min - face_height * 0.42
    crop_bottom = y_max + face_height * 0.22

    target_width, target_height = output_size
    target_aspect = target_width / target_height
    crop_width = crop_right - crop_left
    crop_height = crop_bottom - crop_top
    crop_aspect = crop_width / max(crop_height, 1.0)

    if crop_aspect > target_aspect:
        desired_height = crop_width / target_aspect
        delta = desired_height - crop_height
        crop_top -= delta * 0.46
        crop_bottom += delta * 0.54
    else:
        desired_width = crop_height * target_aspect
        delta = desired_width - crop_width
        crop_left -= delta / 2.0
        crop_right += delta / 2.0

    x0 = int(np.floor(crop_left))
    y0 = int(np.floor(crop_top))
    x1 = int(np.ceil(crop_right))
    y1 = int(np.ceil(crop_bottom))

    pad_left = max(0, -x0)
    pad_top = max(0, -y0)
    pad_right = max(0, x1 - width)
    pad_bottom = max(0, y1 - height)

    safe_x0 = max(0, x0)
    safe_y0 = max(0, y0)
    safe_x1 = min(width, x1)
    safe_y1 = min(height, y1)
    crop = image[safe_y0:safe_y1, safe_x0:safe_x1]

    if crop.size == 0:
        return cv2.resize(image, output_size, interpolation=cv2.INTER_CUBIC)

    if any((pad_left, pad_top, pad_right, pad_bottom)):
        crop = cv2.copyMakeBorder(
            crop,
            pad_top,
            pad_bottom,
            pad_left,
            pad_right,
            borderType=cv2.BORDER_REPLICATE,
        )

    return cv2.resize(crop, output_size, interpolation=cv2.INTER_CUBIC)
