"""Image validation and loading utility."""
import cv2
import numpy as np
from io import BytesIO


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
        
        return img
    except Exception:
        return None
