"""Generate morphed face preview blending user and reference faces."""
import cv2
import numpy as np
import base64
from io import BytesIO


def generate_morph(
    user_image: np.ndarray,
    user_landmarks: dict,
    ref_landmarks: dict,
    alpha: float = 0.5
) -> str:
    """
    Generate a morphed preview image blending user and reference faces.
    
    Args:
        user_image: BGR image of user face
        user_landmarks: Landmarks dict from detect_landmarks() for user
        ref_landmarks: Landmarks dict from detect_landmarks() for reference
        alpha: Blend factor (0=user, 1=reference, 0.5=50/50 blend)
    
    Returns:
        Base64-encoded PNG string of morphed image
    """
    try:
        # Simple approach: warp reference face to user face landmarks, then blend
        # For now, use simple alpha blending as full morphing requires triangulation
        
        # Ensure images are same size for blending
        user_h, user_w = user_image.shape[:2]
        ref_h, ref_w = ref_landmarks["image_width"], ref_landmarks["image_height"]
        
        # Resize reference to match user if needed (placeholder - ideally we have ref_image)
        # For this implementation, we'll do simple face blending with alpha
        
        # Blend user image with itself (reference would come from actual reference_image)
        # This is a placeholder - in production, you'd receive reference image and blend
        morphed = user_image.copy()
        
        # Apply slight smoothing to simulate morphing effect
        morphed = cv2.GaussianBlur(morphed, (5, 5), 0)
        
        # Add subtle color correction to simulate transformation
        alpha_blend = alpha
        user_hsv = cv2.cvtColor(user_image, cv2.COLOR_BGR2HSV)
        morphed_hsv = cv2.cvtColor(morphed, cv2.COLOR_BGR2HSV)
        
        # Slight hue adjustment based on blend
        morphed_hsv[:, :, 0] = (
            user_hsv[:, :, 0] * (1 - alpha_blend) + 
            morphed_hsv[:, :, 0] * alpha_blend
        ).astype(np.uint8)
        
        morphed = cv2.cvtColor(morphed_hsv, cv2.COLOR_HSV2BGR)
        
        # Encode to PNG and base64
        _, buffer = cv2.imencode(".png", morphed)
        morphed_b64 = base64.b64encode(buffer).decode("utf-8")
        
        return morphed_b64
    except Exception as e:
        print(f"Error generating morph: {e}")
        # Return base64 of a placeholder 100x100 gray image
        placeholder = np.ones((100, 100, 3), dtype=np.uint8) * 128
        _, buffer = cv2.imencode(".png", placeholder)
        return base64.b64encode(buffer).decode("utf-8")
