from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.services.image_validator import validate_image
from app.services.landmark_detector import detect_landmarks
from app.services.structural_comparator import compare_structures
from app.services.procedure_mapper import map_procedures
from app.services.price_estimator import estimate_prices
from app.services.face_morpher import generate_morph
import base64

router = APIRouter()


@router.post("/analyze")
async def analyze_faces(
    user_image: UploadFile = File(...),
    reference_image: UploadFile = File(...)
):
    """
    Main endpoint: upload user face + reference face,
    returns procedure suggestions + price estimates.
    """
    # 1. Validate images
    user_bytes = await user_image.read()
    ref_bytes = await reference_image.read()

    user_img = validate_image(user_bytes)
    ref_img = validate_image(ref_bytes)

    if user_img is None or ref_img is None:
        raise HTTPException(status_code=400, detail="Invalid image format or no face detected")

    # 2. Detect landmarks with MediaPipe Face Mesh
    user_landmarks = detect_landmarks(user_img)
    ref_landmarks = detect_landmarks(ref_img)

    if user_landmarks is None:
        raise HTTPException(status_code=422, detail="Could not detect face in user image")
    if ref_landmarks is None:
        raise HTTPException(status_code=422, detail="Could not detect face in reference image")

    # 3. Compute structural deviation per region
    deviation_scores = compare_structures(user_landmarks, ref_landmarks)

    # 4. Map deviations → procedure suggestions
    procedures = map_procedures(deviation_scores)

    # 5. Estimate prices for each procedure
    priced_result = estimate_prices(procedures)

    # 6. Generate morphed preview image
    morphed_b64 = generate_morph(user_img, user_landmarks, ref_landmarks, alpha=0.5)

    return JSONResponse({
        "similarity_score": deviation_scores.get("overall_similarity"),
        "average_difference": deviation_scores.get("average_difference"),
        "mean_deviation": deviation_scores.get("mean_deviation"),
        "deviation_by_region": deviation_scores.get("regions"),
        "region_differences": deviation_scores.get("region_details"),
        "procedures": priced_result["procedures"],
        "package_summary": priced_result["package_summary"],
        "morphed_image": morphed_b64,  # base64 PNG
    })
