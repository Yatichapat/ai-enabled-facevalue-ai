# FaceValue AI

FaceValue AI is an AI-assisted facial analysis system designed to help users compare their facial structure with a desired reference face and explore possible cosmetic procedure insights. The project combines facial landmark detection, structural comparison, procedure mapping, face morphing visualization, and price estimation to support pre-consultation planning for cosmetic procedures.

This is a prototype and is not medical advice.


## Requirements

- Python 3.11+
- Node.js and npm

## Install

Backend:

```powershell
cd backend
pip install -r requirements.txt
```

Frontend:

```powershell
cd frontend
npm install
```

## Run

Start the backend:

```powershell
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Start the frontend:

```powershell
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

The frontend uses this backend by default:

```text
http://localhost:8000
```

To use another backend URL:

```powershell
$env:NEXT_PUBLIC_BACKEND_URL="http://127.0.0.1:8000"
npm run dev
```


Health check:

```http
GET /
```

Analyze two faces:

```http
POST /analysis/analyze
Content-Type: multipart/form-data
```

Form fields:

- `user_image`: PNG or JPG face image.
- `reference_image`: PNG or JPG reference face image.

Example response:

```json
{
  "similarity_score": 87.06,
  "average_difference": 12.94,
  "mean_deviation": 12.94,
  "alignment": {
    "applied": true,
    "anchor_count": 11,
    "used_anchor_count": 8,
    "median_anchor_residual": 0.013,
    "scale": 1.024
  },
  "deviation_by_region": {
    "forehead": 7.27,
    "left_eye": 12.84,
    "right_eye": 7.87,
    "nose": 6.42,
    "mouth": 15.1,
    "jawline": 6.39,
    "cheeks": 8.84,
    "chin": 20.33,
    "eyebrows": 35.37
  },
  "region_differences": {
    "chin": {
      "average_difference": 20.33,
      "shape_difference": 69.83,
      "landmark_count": 24
    }
  },
  "face_region_anchors": [
    {
      "region": "forehead",
      "x": 0.525,
      "y": 0.291
    },
    {
      "region": "eyes",
      "x": 0.512,
      "y": 0.456
    }
  ],
  "procedures": [
    {
      "procedure": "Chin Fillers",
      "region": "chin",
      "deviation": 20.33,
      "priority": 100.0,
      "benefit": "Non-surgical chin enhancement",
      "price": 500.0
    }
  ],
  "package_summary": {
    "type": "package",
    "procedures_count": 7,
    "subtotal": 6900.0,
    "discount": 345.0,
    "total": 6555.0
  },
  "analyzed_user_image": "base64_png_string",
  "analyzed_reference_image": "base64_png_string",
  "morphed_image": "base64_png_string"
}
```

API responses from `/analysis/analyze` are saved in for:

```text
backend/api_responses/
```

## MediaPipe AI Source

This app uses Google's MediaPipe Face Mesh for facial landmark detection.

Installed package:

```text
mediapipe==0.10.21
```

Local integration:

```text
backend/app/services/landmark_detector.py
```

Sources:

- https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
- https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md
- https://github.com/google-ai-edge/mediapipe
