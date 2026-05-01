"""Map facial deviations to recommended cosmetic procedures."""


# Procedure mapping: region -> [(procedure_name, deviation_threshold, benefit_description)]
PROCEDURE_MAP = {
    "forehead": [
        ("Botox (Forehead)", 10, "Reduces forehead wrinkles and lines"),
        ("Fillers (Forehead)", 20, "Adds volume to flatten deep lines"),
    ],
    "right_eye": [
        ("Botox (Right Eye)", 8, "Smooths crow's feet and eye wrinkles"),
        ("Fillers (Right Eye)", 15, "Enhances eye area definition"),
        ("Eyelid Lift", 25, "Corrects drooping eyelids"),
    ],
    "left_eye": [
        ("Botox (Left Eye)", 8, "Smooths crow's feet and eye wrinkles"),
        ("Fillers (Left Eye)", 15, "Enhances eye area definition"),
        ("Eyelid Lift", 25, "Corrects drooping eyelids"),
    ],
    "nose": [
        ("Rhinoplasty", 15, "Reshapes nose for better symmetry"),
        ("Fillers (Nose)", 8, "Non-surgical nose enhancement"),
    ],
    "mouth": [
        ("Lip Fillers", 12, "Enhances lip volume and definition"),
        ("Botox (Mouth)", 10, "Reduces mouth wrinkles"),
        ("Smile Lift", 20, "Elevates mouth corners"),
    ],
    "jawline": [
        ("Jaw Contouring", 18, "Defines and strengthens jawline"),
        ("Fillers (Jawline)", 12, "Adds definition to jawline"),
        ("Botox (Masseter)", 15, "Reduces jaw width"),
    ],
    "cheeks": [
        ("Cheek Fillers", 14, "Enhances cheekbone definition"),
        ("Cheek Implants", 20, "Permanent cheek augmentation"),
        ("Microdermabrasion", 8, "Improves cheek skin texture"),
    ],
    "chin": [
        ("Chin Augmentation", 18, "Enhances chin projection"),
        ("Chin Fillers", 10, "Non-surgical chin enhancement"),
        ("Botox (Chin)", 8, "Smooths chin dimpling"),
    ],
}


def map_procedures(deviation_scores: dict) -> list:
    """
    Map facial deviations to cosmetic procedure recommendations.
    
    Args:
        deviation_scores: Dict from compare_structures() with 'regions' key
    
    Returns:
        List of recommended procedures with priority scores
    """
    regions = deviation_scores.get("regions", {})
    recommended = []
    
    for region_name, deviation in regions.items():
        if region_name not in PROCEDURE_MAP:
            continue
        
        procedures = PROCEDURE_MAP[region_name]
        for proc_name, threshold, benefit in procedures:
            if deviation >= threshold:
                # Priority = deviation magnitude (higher deviation = higher priority)
                priority = min(100, (deviation / threshold) * 50)  # 0-50 scale
                recommended.append({
                    "procedure": proc_name,
                    "region": region_name,
                    "deviation": float(deviation),
                    "threshold": threshold,
                    "priority": float(priority),
                    "benefit": benefit,
                })
    
    # Sort by priority (highest first)
    recommended.sort(key=lambda x: x["priority"], reverse=True)
    
    return recommended
