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
    
    region_deviations = {}
    region_details = {}
    all_distances = []
    
    for region_name, indices in FACIAL_REGIONS.items():
        valid_indices = [i for i in indices if i < len(user_pts) and i < len(ref_pts)]
        
        if not valid_indices:
            region_deviations[region_name] = 0.0
            region_details[region_name] = {
                "average_difference": 0.0,
                "max_difference": 0.0,
                "landmark_count": 0,
            }
            continue
        
        distances = np.linalg.norm(user_pts[valid_indices] - ref_pts[valid_indices], axis=1) * 100.0
        mean_deviation = float(np.mean(distances))
        region_deviations[region_name] = mean_deviation
        region_details[region_name] = {
            "average_difference": mean_deviation,
            "max_difference": float(np.max(distances)),
            "landmark_count": len(valid_indices),
        }
        all_distances.extend(distances)
    
    overall_distance = float(np.mean(all_distances)) if all_distances else 0.0
    overall_similarity = max(0.0, 100.0 - overall_distance)
    
    return {
        "overall_similarity": overall_similarity,
        "regions": region_deviations,
        "region_details": region_details,
        "mean_deviation": overall_distance,
        "average_difference": overall_distance,
    }
