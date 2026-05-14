from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.services.image_validator import validate_image
from app.services.landmark_detector import detect_landmarks
from app.services.face_preprocessor import crop_face_roi, enhance_image, resize_for_processing
from app.services.face_quality import evaluate_face_quality
from app.services.structural_comparator import compare_structures
from app.services.procedure_mapper import map_procedures
from app.services.price_estimator import estimate_prices
from app.services.face_morpher import generate_morph
import base64
import cv2
import numpy as np

router = APIRouter()


def _encode_png_base64(image) -> str | None:
    success, buffer = cv2.imencode(".png", image)
    if not success:
        return None

    return base64.b64encode(buffer).decode("utf-8")


def _raise_if_rejected(label: str, report) -> None:
    if report.accepted:
        return

    joined_reasons = " ".join(report.reasons)
    raise HTTPException(status_code=422, detail=f"{label} image rejected: {joined_reasons}")


def _prepare_face(image: np.ndarray, label: str) -> tuple[np.ndarray, np.ndarray, dict, dict]:
    """
    Validate, crop, and re-detect the face.

    The first landmark pass finds the face in the full image and rejects bad input.
    The second pass runs on an enhanced crop for reliable landmarks. The display
    crop uses the same geometry but keeps the original photo appearance.
    """
    display_base_image = resize_for_processing(image)
    enhanced_image = enhance_image(display_base_image)
    initial_landmarks = detect_landmarks(enhanced_image)

    if initial_landmarks is None:
        raise HTTPException(status_code=422, detail=f"Could not detect face in {label.lower()} image")

    initial_quality = evaluate_face_quality(enhanced_image, initial_landmarks)
    _raise_if_rejected(label, initial_quality)

    display_image = crop_face_roi(display_base_image, initial_landmarks)
    analysis_crop = crop_face_roi(enhanced_image, initial_landmarks)
    analysis_image = enhance_image(analysis_crop)
    processed_landmarks = detect_landmarks(analysis_image)

    if processed_landmarks is None:
        raise HTTPException(status_code=422, detail=f"Could not detect face after processing {label.lower()} image")

    processed_quality = evaluate_face_quality(analysis_image, processed_landmarks)
    _raise_if_rejected(label, processed_quality)

    return analysis_image, display_image, processed_landmarks, {
        "initial": initial_quality.to_dict(),
        "processed": processed_quality.to_dict(),
    }


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
    if user_img is None:
        raise HTTPException(status_code=400, detail="User image rejected: Invalid image format or no face detected")

    ref_img = validate_image(ref_bytes)
    if ref_img is None:
        raise HTTPException(status_code=400, detail="Reference image rejected: Invalid image format or no face detected")

    # 2. Enhance input images, reject bad pose/quality, and re-detect on cropped ROIs
    user_img, user_display_img, user_landmarks, user_quality = _prepare_face(user_img, "User")
    ref_img, ref_display_img, ref_landmarks, ref_quality = _prepare_face(ref_img, "Reference")

    # 3. Compute structural deviation per region
    deviation_scores = compare_structures(user_landmarks, ref_landmarks)

    # 4. Map deviations → procedure suggestions
    procedures = map_procedures(deviation_scores)

    # 5. Estimate prices for each procedure
    priced_result = estimate_prices(procedures)

    # 6. Generate morphed preview image
    morphed_b64 = generate_morph(user_img, user_landmarks, ref_landmarks, alpha=0.5)
    analyzed_user_image_b64 = _encode_png_base64(user_display_img)
    analyzed_reference_image_b64 = _encode_png_base64(ref_display_img)

    return JSONResponse({
        "similarity_score": deviation_scores.get("overall_similarity"),
        "average_difference": deviation_scores.get("average_difference"),
        "mean_deviation": deviation_scores.get("mean_deviation"),
        "alignment": deviation_scores.get("alignment"),
        "quality": deviation_scores.get("quality"),
        "input_quality": {
            "user": user_quality,
            "reference": ref_quality,
        },
        "deviation_by_region": deviation_scores.get("regions"),
        "region_differences": deviation_scores.get("region_details"),
        "face_region_anchors": deviation_scores.get("face_region_anchors"),
        "procedures": priced_result["procedures"],
        "package_summary": priced_result["package_summary"],
        "analyzed_user_image": analyzed_user_image_b64,
        "analyzed_reference_image": analyzed_reference_image_b64,
        "morphed_image": morphed_b64,  # base64 PNG
    })
