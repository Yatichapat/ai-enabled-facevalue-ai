"""Facial landmark detection using MediaPipe Face Mesh."""
import sys
import types

import numpy as np
import cv2

def _do_not_generate_docs(value=None):
    if value is None:
        return lambda decorated_value: decorated_value
    return value


# MediaPipe only imports tensorflow.tools.docs for API documentation decorators.
# In a shared Python install, a broken TensorFlow/protobuf combination can make
# that optional import fail before MediaPipe starts. Stub it because this service
# does not use TensorFlow.
doc_controls = types.ModuleType("doc_controls")
doc_controls.do_not_generate_docs = _do_not_generate_docs
tensorflow = types.ModuleType("tensorflow")
tensorflow_tools = types.ModuleType("tensorflow.tools")
tensorflow_docs = types.ModuleType("tensorflow.tools.docs")
tensorflow_docs.doc_controls = doc_controls
sys.modules.setdefault("tensorflow", tensorflow)
sys.modules.setdefault("tensorflow.tools", tensorflow_tools)
sys.modules.setdefault("tensorflow.tools.docs", tensorflow_docs)
sys.modules.setdefault("tensorflow.tools.docs.doc_controls", doc_controls)

import mediapipe as mp


FACE_MESH = mp.solutions.face_mesh.FaceMesh(
    static_image_mode=True,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.5,
)


def detect_landmarks(image: np.ndarray) -> dict | None:
    """
    Detect facial landmarks using MediaPipe Face Mesh.
    
    Args:
        image: BGR image from OpenCV (np.ndarray)
    
    Returns:
        Dict with normalized landmarks and image dimensions, or None if no face is detected.
    """
    try:
        height, width = image.shape[:2]
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        rgb_image.flags.writeable = False

        result = FACE_MESH.process(rgb_image)

        if not result.multi_face_landmarks:
            return None

        face_landmarks = result.multi_face_landmarks[0]
        landmarks = [
            {
                "x": float(point.x),
                "y": float(point.y),
                "z": float(point.z),
                "pixel_x": float(point.x * width),
                "pixel_y": float(point.y * height),
            }
            for point in face_landmarks.landmark
        ]

        return {
            "landmarks": landmarks,
            "image_width": width,
            "image_height": height,
            "num_landmarks": len(landmarks),
        }
    except Exception as e:
        print(f"Error detecting landmarks: {e}")
        return None
