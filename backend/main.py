from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import json

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from app.routers import analysis

API_RESPONSE_DIR = Path(__file__).resolve().parent / "api_responses"

app = FastAPI(
    title="FaceValue AI API",
    description="AI-Based Facial Structural Analysis for Cosmetic Procedure Mapping",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router, prefix="/analysis", tags=["analysis"])


def _response_log_path(request: Request, status_code: int) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    route = request.url.path.strip("/").replace("/", "_") or "root"
    return API_RESPONSE_DIR / f"{timestamp}_{request.method}_{route}_{status_code}_{uuid4().hex[:8]}.json"


def _save_api_response(request: Request, status_code: int, body: bytes) -> None:
    if not body:
        return

    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return

    log_payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "method": request.method,
        "path": request.url.path,
        "status_code": status_code,
        "response": payload,
    }

    try:
        API_RESPONSE_DIR.mkdir(parents=True, exist_ok=True)
        _response_log_path(request, status_code).write_text(
            json.dumps(log_payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    except OSError:
        # Response logging must never block the API response itself.
        return


@app.middleware("http")
async def save_json_api_responses(request: Request, call_next):
    response = await call_next(request)

    if request.method != "POST" or request.url.path != "/analysis/analyze":
        return response

    content_type = response.headers.get("content-type", "")
    if "application/json" not in content_type:
        return response

    body = b""
    async for chunk in response.body_iterator:
        body += chunk

    _save_api_response(request, response.status_code, body)

    headers = dict(response.headers)
    headers["content-length"] = str(len(body))
    return Response(
        content=body,
        status_code=response.status_code,
        headers=headers,
        media_type=response.media_type,
        background=response.background,
    )

@app.get("/")
async def root():
    return {"message": "FaceValue AI API is running!"}
