"""Structural comparison between two faces."""
import numpy as np


# Define facial regions with landmark indices
FACIAL_REGIONS = {
    "nose":     list(range(1, 6)) + [19, 94, 125, 141, 235, 44, 274, 355, 460],
    "eyes":     list(range(33, 46)) + list(range(133, 146)) +
                list(range(362, 375)) + list(range(263, 276)),
    "lips":     list(range(61, 80)) + list(range(291, 310)),
    "jawline":  [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361,
                 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149,
                 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
    "eyebrows": list(range(46, 55)) + list(range(276, 285)),
    "cheeks":   [50, 205, 425, 280, 425, 280],
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
        return {"overall_similarity": 0.0, "regions": {}}
    
    user_pts = np.array([[lm["x"], lm["y"], lm["z"]] for lm in user_landmarks["landmarks"]])
    ref_pts = np.array([[lm["x"], lm["y"], lm["z"]] for lm in ref_landmarks["landmarks"]])
    
    region_deviations = {}
    all_distances = []
    
    for region_name, indices in FACIAL_REGIONS.items():
        # Filter valid indices
        valid_indices = [i for i in indices if i < len(user_pts) and i < len(ref_pts)]
        
        if not valid_indices:
            region_deviations[region_name] = 0.0
            continue
        
        # Compute Euclidean distances
        distances = np.linalg.norm(user_pts[valid_indices] - ref_pts[valid_indices], axis=1)
        mean_deviation = float(np.mean(distances))
        region_deviations[region_name] = mean_deviation
        all_distances.extend(distances)
    
    # Overall similarity: lower mean distance = higher similarity
    overall_distance = float(np.mean(all_distances)) if all_distances else 0.0
    # Normalize to 0-100 scale (assuming max reasonable deviation is ~50 pixels)
    overall_similarity = max(0, 100 - (overall_distance * 2))
    
    return {
        "overall_similarity": overall_similarity,
        "regions": region_deviations,
        "mean_deviation": overall_distance
    }
