"""Image validation and loading utility."""
import cv2
import numpy as np


MAX_IMAGE_SIDE = 1200


def _resize_if_needed(image: np.ndarray, max_side: int = MAX_IMAGE_SIDE) -> np.ndarray:
    """Resize oversized images while preserving aspect ratio."""
    height, width = image.shape[:2]
    longest_side = max(height, width)

    if longest_side <= max_side:
        return image

    scale = max_side / float(longest_side)
    new_width = max(1, int(round(width * scale)))
    new_height = max(1, int(round(height * scale)))
    return cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)


def validate_image(image_bytes: bytes) -> np.ndarray | None:
    """
    Validate and load image from bytes.
    
    Args:
        image_bytes: Raw image data in bytes (JPEG, PNG, etc.)
    
    Returns:
        NumPy array (BGR format) if valid, None otherwise
    """
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        # Decode image (BGR format for OpenCV)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return None
        
        # Basic validation: image should have reasonable dimensions
        height, width = img.shape[:2]
        if height < 100 or width < 100:
            return None

        return _resize_if_needed(img)
    except Exception:
        return None
