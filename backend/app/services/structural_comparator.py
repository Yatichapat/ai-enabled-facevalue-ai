"""Structural comparison between two MediaPipe face landmark sets."""
import numpy as np


FACIAL_REGIONS = {
    "forehead": [10, 67, 69, 104, 108, 109, 151, 297, 299, 333, 337, 338],
    "left_eye": [33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 158, 157, 173],
    "right_eye": [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
    "nose": [1, 2, 4, 5, 6, 19, 45, 94, 97, 98, 115, 168, 195, 197, 220, 275, 326, 327, 344, 440],
    "mouth": [0, 13, 14, 17, 37, 39, 40, 61, 78, 80, 81, 82, 84, 87, 88, 91, 95, 146, 178, 181, 185,
              191, 267, 269, 270, 291, 308, 310, 311, 312, 314, 317, 318, 321, 324, 375, 402, 405, 409, 415],
    "jawline": [10, 21, 54, 58, 67, 93, 103, 109, 127, 132, 136, 148, 149, 150, 152, 162, 172, 176,
                234, 251, 284, 288, 297, 323, 332, 338, 356, 361, 365, 377, 378, 379, 389, 397, 400, 454],
    "cheeks": [50, 101, 116, 117, 118, 119, 123, 147, 187, 205, 206, 207, 213, 216,
               280, 330, 345, 346, 347, 348, 352, 376, 411, 425, 426, 427, 436],
    "chin": [18, 32, 83, 140, 148, 149, 152, 175, 176, 199, 200, 201, 208, 210, 211, 262, 313, 369, 377,
             378, 421, 428, 430, 431],
    "eyebrows": [46, 52, 53, 55, 63, 65, 66, 70, 105, 107, 276, 282, 283, 285, 293, 295, 296, 300, 334, 336],
}

ALIGNMENT_ANCHORS = [
    33,   # left outer eye
    133,  # left inner eye
    362,  # right inner eye
    263,  # right outer eye
    1,    # nose tip
    168,  # nose bridge
    61,   # left mouth corner
    291,  # right mouth corner
    13,   # upper lip
    14,   # lower lip
    152,  # chin
]

REGION_WEIGHTS = {
    "forehead": 0.7,
    "left_eye": 1.15,
    "right_eye": 1.15,
    "nose": 1.2,
    "mouth": 1.1,
    "jawline": 0.85,
    "cheeks": 0.9,
    "chin": 0.9,
    "eyebrows": 0.8,
}


def _landmark_array(landmark_payload: dict) -> np.ndarray:
    return np.array(
        [[lm["x"], lm["y"], lm["z"]] for lm in landmark_payload["landmarks"]],
        dtype=np.float32,
    )


def _normalize_landmarks(points: np.ndarray) -> np.ndarray:
    """
    Center and scale landmarks so comparison is independent of image size and face placement.
    Distances are later reported as percentage points of normalized face size.
    """
    centered = points - np.mean(points, axis=0)
    xy = centered[:, :2]
    face_size = np.linalg.norm(np.max(xy, axis=0) - np.min(xy, axis=0))

    if face_size <= 0:
        return centered

    normalized = centered / face_size
    normalized[:, 2] *= 0.35
    return normalized


def _robust_mean(values: np.ndarray, trim_ratio: float = 0.15) -> float:
    if values.size == 0:
        return 0.0

    if values.size < 4:
        return float(np.mean(values))

    sorted_values = np.sort(values)
    trim_count = int(values.size * trim_ratio)

    if trim_count <= 0:
        return float(np.mean(sorted_values))

    trimmed = sorted_values[trim_count:-trim_count]
    if trimmed.size == 0:
        return float(np.mean(sorted_values))

    return float(np.mean(trimmed))


def _valid_anchor_indices(user_points: np.ndarray, ref_points: np.ndarray) -> list[int]:
    max_index = min(len(user_points), len(ref_points))
    return [index for index in ALIGNMENT_ANCHORS if index < max_index]


def _solve_similarity_transform(
    source_xy: np.ndarray,
    target_xy: np.ndarray,
) -> tuple[np.ndarray, float, np.ndarray]:
    source_center = np.mean(source_xy, axis=0)
    target_center = np.mean(target_xy, axis=0)
    source_centered = source_xy - source_center
    target_centered = target_xy - target_center

    source_scale = np.linalg.norm(source_centered)
    target_scale = np.linalg.norm(target_centered)

    if source_scale <= 0 or target_scale <= 0:
        raise ValueError("invalid_anchor_scale")

    covariance = source_centered.T @ target_centered
    u_matrix, _, vt_matrix = np.linalg.svd(covariance)
    rotation = u_matrix @ vt_matrix

    if np.linalg.det(rotation) < 0:
        u_matrix[:, -1] *= -1
        rotation = u_matrix @ vt_matrix

    scale = target_scale / source_scale
    translation = target_center - (source_center @ rotation) * scale
    return rotation, float(scale), translation


def _apply_similarity_transform(
    points: np.ndarray,
    rotation: np.ndarray,
    scale: float,
    translation: np.ndarray,
) -> np.ndarray:
    aligned = points.copy()
    aligned[:, :2] = (aligned[:, :2] @ rotation) * scale + translation
    return aligned


def _align_to_reference(user_points: np.ndarray, ref_points: np.ndarray) -> tuple[np.ndarray, dict]:
    """
    Align user landmarks to reference landmarks using 2D Procrustes alignment.
    Z is left normalized but not used to solve rotation because MediaPipe's depth
    is relative and noisier than image-plane landmarks.
    """
    anchor_indices = _valid_anchor_indices(user_points, ref_points)

    if len(anchor_indices) < 3:
        return user_points, {
            "applied": False,
            "anchor_count": len(anchor_indices),
            "reason": "not_enough_anchors",
        }

    user_anchor_xy = user_points[anchor_indices, :2]
    ref_anchor_xy = ref_points[anchor_indices, :2]

    try:
        rotation, scale, translation = _solve_similarity_transform(user_anchor_xy, ref_anchor_xy)
    except ValueError as error:
        return user_points, {
            "applied": False,
            "anchor_count": len(anchor_indices),
            "reason": str(error),
        }

    initially_aligned = _apply_similarity_transform(user_points, rotation, scale, translation)
    anchor_residuals = np.linalg.norm(
        initially_aligned[anchor_indices, :2] - ref_points[anchor_indices, :2],
        axis=1,
    )
    median_residual = float(np.median(anchor_residuals))
    mad = float(np.median(np.abs(anchor_residuals - median_residual)))
    residual_limit = median_residual + max(2.5 * mad, 0.01)
    kept_mask = anchor_residuals <= residual_limit

    if np.count_nonzero(kept_mask) >= 3 and not np.all(kept_mask):
        kept_user_anchor_xy = user_anchor_xy[kept_mask]
        kept_ref_anchor_xy = ref_anchor_xy[kept_mask]
        rotation, scale, translation = _solve_similarity_transform(
            kept_user_anchor_xy,
            kept_ref_anchor_xy,
        )

    aligned = _apply_similarity_transform(user_points, rotation, scale, translation)

    return aligned, {
        "applied": True,
        "anchor_count": len(anchor_indices),
        "used_anchor_count": int(np.count_nonzero(kept_mask)),
        "median_anchor_residual": median_residual,
        "scale": float(scale),
    }


def _region_shape_features(points: np.ndarray) -> np.ndarray:
    xy = points[:, :2]
    x_min, y_min = np.min(xy, axis=0)
    x_max, y_max = np.max(xy, axis=0)
    width = max(float(x_max - x_min), 1e-6)
    height = max(float(y_max - y_min), 1e-6)
    centroid = np.mean(xy, axis=0)

    return np.array(
        [
            width,
            height,
            width / height,
            float(centroid[0]),
            float(centroid[1]),
        ],
        dtype=np.float32,
    )


def _compare_region(user_region: np.ndarray, ref_region: np.ndarray) -> dict:
    distances = np.linalg.norm(user_region - ref_region, axis=1) * 100.0
    robust_distance = _robust_mean(distances)
    raw_mean_distance = float(np.mean(distances)) if distances.size else 0.0
    median_distance = float(np.median(distances)) if distances.size else 0.0
    max_distance = float(np.max(distances)) if distances.size else 0.0

    user_features = _region_shape_features(user_region)
    ref_features = _region_shape_features(ref_region)
    feature_difference = float(np.linalg.norm(user_features - ref_features) * 100.0)
    combined_difference = (robust_distance * 0.75) + (feature_difference * 0.25)

    return {
        "average_difference": float(combined_difference),
        "trimmed_landmark_difference": float(robust_distance),
        "raw_landmark_difference": raw_mean_distance,
        "median_landmark_difference": median_distance,
        "max_difference": max_distance,
        "shape_difference": feature_difference,
        "landmark_count": int(len(user_region)),
    }


def _face_quality(points: np.ndarray) -> dict:
    required_indices = [1, 33, 61, 133, 152, 263, 291, 362]
    if any(index >= len(points) for index in required_indices):
        return {
            "available": False,
            "warnings": ["not_enough_landmarks_for_quality_checks"],
        }

    xy = points[:, :2]
    x_min, y_min = np.min(xy, axis=0)
    x_max, y_max = np.max(xy, axis=0)
    face_width = max(float(x_max - x_min), 1e-6)
    face_height = max(float(y_max - y_min), 1e-6)
    nose = points[1, :2]
    left_eye = np.mean(points[[33, 133], :2], axis=0)
    right_eye = np.mean(points[[362, 263], :2], axis=0)
    left_mouth = points[61, :2]
    right_mouth = points[291, :2]
    chin = points[152, :2]

    eye_center = (left_eye + right_eye) / 2.0
    mouth_center = (left_mouth + right_mouth) / 2.0
    eye_vector = right_eye - left_eye
    roll_degrees = float(np.degrees(np.arctan2(eye_vector[1], eye_vector[0])))
    horizontal_center_drift = float(abs(nose[0] - eye_center[0]) / face_width)
    vertical_balance = float(abs(mouth_center[1] - ((eye_center[1] + chin[1]) / 2.0)) / face_height)

    warnings = []
    if abs(roll_degrees) > 8:
        warnings.append("face_roll_over_8_degrees")
    if horizontal_center_drift > 0.08:
        warnings.append("possible_yaw_or_off_center_face")
    if vertical_balance > 0.18:
        warnings.append("unusual_vertical_landmark_balance")

    return {
        "available": True,
        "roll_degrees": roll_degrees,
        "horizontal_center_drift": horizontal_center_drift,
        "vertical_balance": vertical_balance,
        "warnings": warnings,
    }


def compare_structures(user_landmarks: dict, ref_landmarks: dict) -> dict:
    """
    Compare facial structures between user and reference faces.
    
    Args:
        user_landmarks: Dict from detect_landmarks() with user face
        ref_landmarks: Dict from detect_landmarks() with reference face
    
    Returns:
        Dict with 'overall_similarity' and 'regions' (deviations per region)
    """
    if not user_landmarks or not ref_landmarks:
        return {"overall_similarity": 0.0, "regions": {}, "region_details": {}, "mean_deviation": 0.0}

    user_pts = _normalize_landmarks(_landmark_array(user_landmarks))
    ref_pts = _normalize_landmarks(_landmark_array(ref_landmarks))
    quality = {
        "user": _face_quality(user_pts),
        "reference": _face_quality(ref_pts),
    }
    user_pts, alignment = _align_to_reference(user_pts, ref_pts)
    
    region_deviations = {}
    region_details = {}
    weighted_region_scores = []
    total_weight = 0.0
    
    for region_name, indices in FACIAL_REGIONS.items():
        valid_indices = [i for i in indices if i < len(user_pts) and i < len(ref_pts)]
        
        if not valid_indices:
            region_deviations[region_name] = 0.0
            region_details[region_name] = {
                "average_difference": 0.0,
                "trimmed_landmark_difference": 0.0,
                "raw_landmark_difference": 0.0,
                "median_landmark_difference": 0.0,
                "max_difference": 0.0,
                "shape_difference": 0.0,
                "landmark_count": 0,
            }
            continue
        
        detail = _compare_region(user_pts[valid_indices], ref_pts[valid_indices])
        region_deviations[region_name] = detail["average_difference"]
        region_details[region_name] = detail

        region_weight = REGION_WEIGHTS.get(region_name, 1.0)
        weighted_region_scores.append(detail["average_difference"] * region_weight)
        total_weight += region_weight
    
    overall_distance = (
        float(sum(weighted_region_scores) / total_weight)
        if total_weight > 0
        else 0.0
    )
    overall_similarity = max(0.0, min(100.0, 100.0 - overall_distance))
    
    return {
        "overall_similarity": overall_similarity,
        "regions": region_deviations,
        "region_details": region_details,
        "mean_deviation": overall_distance,
        "average_difference": overall_distance,
        "alignment": alignment,
        "quality": quality,
    }
