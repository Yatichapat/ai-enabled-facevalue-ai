# FaceValue AI

FaceValue AI has two parts:

- `backend`: FastAPI service for image validation, MediaPipe face landmarks, comparison, and procedure recommendations.
- `frontend`: Next.js app for uploading/capturing photos and viewing results.

## Requirements

- Python 3.11+
- Node.js and npm

## Install

Open two terminals from the project root.

### Backend

```powershell
cd backend
pip install -r requirements.txt
```

### Frontend

```powershell
cd frontend
npm install
```

## Run

### Start the backend

```powershell
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Backend URL:

```text
http://127.0.0.1:8000
```

### Start the frontend

```powershell
cd frontend
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

## Use the App

1. Open `http://localhost:3000`.
2. Upload or capture your face photo.
3. Upload a reference face photo.
4. Click `Start Analyzing`.

The frontend calls the backend at `http://localhost:8000` by default. To use a different backend URL, set:

```powershell
$env:NEXT_PUBLIC_BACKEND_URL="http://127.0.0.1:8000"
```

## Backend API

### Health Check

```http
GET /
```

Response:

```json
{
  "message": "FaceValue AI API is running!"
}
```

### Analyze Faces

```http
POST /analysis/analyze
Content-Type: multipart/form-data
```

Form fields:

- `user_image`: PNG or JPG image of the user's face.
- `reference_image`: PNG or JPG reference face image.

Example response:

```json
{
  "similarity_score": 87.4,
  "average_difference": 12.6,
  "mean_deviation": 12.6,
  "alignment": {
    "applied": true,
    "anchor_count": 11,
    "used_anchor_count": 10,
    "median_anchor_residual": 0.012,
    "scale": 1.03
  },
  "quality": {
    "user": {
      "available": true,
      "roll_degrees": 1.8,
      "horizontal_center_drift": 0.03,
      "vertical_balance": 0.08,
      "warnings": []
    },
    "reference": {
      "available": true,
      "roll_degrees": -0.9,
      "horizontal_center_drift": 0.02,
      "vertical_balance": 0.07,
      "warnings": []
    }
  },
  "input_quality": {
    "user": {
      "initial": {
        "accepted": true,
        "reasons": [],
        "warnings": [],
        "metrics": {
          "mean_luminance": 118.2,
          "contrast": 48.5,
          "dark_ratio": 0.04,
          "bright_ratio": 0.01,
          "sharpness": 92.7,
          "face_width_px": 420.0,
          "face_height_px": 520.0,
          "face_area_ratio": 0.18,
          "roll_degrees": 1.8,
          "nose_eye_offset": 0.08,
          "nose_mouth_offset": 0.12,
          "eye_width_ratio": 0.91,
          "face_side_ratio": 0.86
        }
      },
      "processed": {
        "accepted": true,
        "reasons": [],
        "warnings": [],
        "metrics": {}
      }
    },
    "reference": {
      "initial": {
        "accepted": true,
        "reasons": [],
        "warnings": [],
        "metrics": {}
      },
      "processed": {
        "accepted": true,
        "reasons": [],
        "warnings": [],
        "metrics": {}
      }
    }
  },
  "deviation_by_region": {
    "forehead": 9.2,
    "left_eye": 7.4,
    "right_eye": 8.1,
    "nose": 14.3,
    "mouth": 10.8,
    "jawline": 16.5,
    "cheeks": 11.9,
    "chin": 13.1,
    "eyebrows": 8.7
  },
  "region_differences": {
    "nose": {
      "average_difference": 14.3,
      "trimmed_landmark_difference": 12.8,
      "raw_landmark_difference": 13.4,
      "median_landmark_difference": 12.1,
      "max_difference": 24.9,
      "shape_difference": 18.7,
      "landmark_count": 20
    }
  },
  "face_region_anchors": [
    {
      "region": "forehead",
      "x": 0.5,
      "y": 0.14
    },
    {
      "region": "eyes",
      "x": 0.5,
      "y": 0.28
    }
  ],
  "procedures": [
    {
      "procedure": "Fillers (Jawline)",
      "region": "jawline",
      "deviation": 16.5,
      "threshold": 12,
      "priority": 68.75,
      "benefit": "Adds definition to jawline",
      "price": 650.0
    }
  ],
  "package_summary": {
    "type": "single",
    "total": 650.0
  },
  "analyzed_user_image": "base64_png_string",
  "analyzed_reference_image": "base64_png_string",
  "morphed_image": "base64_png_string"
}
```

Notes:

- `analyzed_user_image` and `analyzed_reference_image` are cropped PNG images encoded as base64 strings.
- `similarity_score` is `100 - average_difference`, clamped between `0` and `100`.
- `input_quality` explains whether the photo passed quality and pose checks.
- `face_region_anchors` gives normalized positions for the frontend overlay labels.

Common error responses:

```json
{
  "detail": "Invalid image format or no face detected"
}
```

```json
{
  "detail": "User image rejected: Face is not front-facing enough. Use a straight-on photo, not a side view."
}
```

```json
{
  "detail": "Could not detect face in reference image"
}
```
