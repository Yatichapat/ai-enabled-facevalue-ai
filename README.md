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
