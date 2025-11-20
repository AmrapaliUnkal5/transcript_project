from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import os
import uuid
import requests
from datetime import datetime

from app.database import get_db
from app.dependency import get_current_user
from app.models import TranscriptRecord, User
from app.utils.file_storage import save_file, get_file_url, FileStorageError
from app.utils.file_storage import resolve_file_url
from app.llm_manager import LLMManager

router = APIRouter(prefix="/transcript", tags=["Transcript Project"])

TRANSCRIPT_DIR = "transcript_prject"


@router.post("/records")
def create_record(
    data: Dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new transcript record with patient info.
    """
    patient_name = data.get("patient_name")
    if not patient_name:
        raise HTTPException(status_code=400, detail="patient_name is required")

    record = TranscriptRecord(
        user_id=current_user.get("user_id"),
        patient_name=patient_name,
        age=data.get("age"),
        bed_no=data.get("bed_no"),
        phone_no=data.get("phone_no"),
        visit_date=datetime.fromisoformat(data["visit_date"]) if data.get("visit_date") else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"record_id": record.id}


@router.post("/records/{record_id}/audio")
async def upload_audio(
    record_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload recorded or pre-recorded audio for the record.
    Stores under transcript_prject/ and returns a resolvable URL/path.
    """
    record = db.query(TranscriptRecord).filter(
        TranscriptRecord.id == record_id, TranscriptRecord.user_id == current_user.get("user_id")
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    # Generate unique filename
    ext = (file.filename or "audio.webm").split(".")[-1].lower()
    if ext not in ["wav", "mp3", "m4a", "webm", "ogg", "mp4"]:
        # accept wide range but keep safe
        ext = "webm"
    filename = f"{uuid.uuid4()}.{ext}"

    try:
        content = await file.read()
        saved_path = save_file(TRANSCRIPT_DIR, filename, content)
        file_url = get_file_url(TRANSCRIPT_DIR, filename, os.getenv("SERVER_URL"))
        resolved_url = resolve_file_url(file_url) if file_url.startswith("s3://") else file_url
    except FileStorageError as e:
        raise HTTPException(status_code=500, detail=f"File storage error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error saving audio: {str(e)}")

    record.audio_path = saved_path  # store raw path (consistent with avatar handling)
    db.commit()

    return {"audio_path": saved_path, "url": resolved_url}


def _openai_transcribe(local_path: str) -> str:
    """
    Minimal OpenAI Whisper transcription via REST to avoid new SDK dependency.
    Requires env OPENAI_API_KEY.
    """
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    url = "https://api.openai.com/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {api_key}"}

    # Prefer whisper-1 for broad availability; allow override
    model = os.getenv("OPENAI_TRANSCRIBE_MODEL", "whisper-1")

    with open(local_path, "rb") as f:
        files = {
            "file": (os.path.basename(local_path), f, "application/octet-stream"),
        }
        data = {"model": model, "temperature": "0"}
        resp = requests.post(url, headers=headers, files=files, data=data, timeout=300)
        if resp.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"OpenAI transcription failed: {resp.text}")
        out = resp.json()
        return out.get("text", "")


@router.post("/records/{record_id}/transcribe")
def transcribe_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Transcribe the uploaded audio using OpenAI Whisper by default.
    """
    record = db.query(TranscriptRecord).filter(
        TranscriptRecord.id == record_id, TranscriptRecord.user_id == current_user.get("user_id")
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if not record.audio_path:
        raise HTTPException(status_code=400, detail="No audio uploaded for this record")

    # If stored path is s3:// not supported here; assume local path under transcript_prject
    local_path = record.audio_path if os.path.isabs(record.audio_path) else os.path.join(TRANSCRIPT_DIR, os.path.basename(record.audio_path))
    if not os.path.exists(local_path):
        # try direct relative
        local_path = record.audio_path
    if not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="Stored audio file not found")

    text = _openai_transcribe(local_path)
    record.transcript_text = text
    db.commit()

    return {"transcript": text}


@router.post("/records/{record_id}/summarize")
def summarize_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Summarize transcript using existing LLMManager provider stack.
    """
    record = db.query(TranscriptRecord).filter(
        TranscriptRecord.id == record_id, TranscriptRecord.user_id == current_user.get("user_id")
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if not record.transcript_text:
        raise HTTPException(status_code=400, detail="No transcript available to summarize")

    llm = LLMManager(bot_id=None, user_id=current_user.get("user_id"), unanswered_message="")
    context = record.transcript_text
    user_message = "Summarize the patient's consultation in concise clinical notes with headings: Complaint, History, Exam, Assessment, Plan."
    result = llm.generate(context=context, user_message=user_message, use_external_knowledge=False, temperature=0.3)

    # llm.generate returns dict with "message" under many call sites; handle str fallback
    summary_text = result["message"] if isinstance(result, dict) and "message" in result else (result if isinstance(result, str) else "")
    record.summary_text = summary_text
    db.commit()

    return {"summary": summary_text}


@router.post("/records/{record_id}/fields")
def generate_dynamic_fields(
    record_id: int,
    payload: Dict[str, List[str]],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Generate answers for user-defined fields using the transcript as context.
    payload: { "fields": ["prescription", "diagnosis", ...] }
    """
    fields = payload.get("fields") or []
    if not isinstance(fields, list) or not fields:
        raise HTTPException(status_code=400, detail="fields must be a non-empty list")

    record = db.query(TranscriptRecord).filter(
        TranscriptRecord.id == record_id, TranscriptRecord.user_id == current_user.get("user_id")
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if not record.transcript_text:
        raise HTTPException(status_code=400, detail="No transcript available")

    llm = LLMManager(bot_id=None, user_id=current_user.get("user_id"), unanswered_message="")
    context = record.transcript_text

    answers: Dict[str, str] = {}
    for label in fields:
        q = f"You are a medical assistant. Based only on the transcript, provide the {label} succinctly. If absent, say 'Not specified'."
        res = llm.generate(context=context, user_message=q, use_external_knowledge=False, temperature=0.2)
        ans = res["message"] if isinstance(res, dict) and "message" in res else (res if isinstance(res, str) else "")
        answers[label] = ans

    # persist
    record.dynamic_fields = {**(record.dynamic_fields or {}), **answers}
    db.commit()

    return {"fields": answers}


@router.get("/records")
def list_records(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List transcript records for current user."""
    rows = (
        db.query(TranscriptRecord)
        .filter(TranscriptRecord.user_id == current_user.get("user_id"))
        .order_by(TranscriptRecord.created_at.desc())
        .all()
    )
    data = []
    for r in rows:
        data.append({
            "id": r.id,
            "patient_name": r.patient_name,
            "age": r.age,
            "bed_no": r.bed_no,
            "phone_no": r.phone_no,
            "visit_date": r.visit_date.isoformat() if r.visit_date else None,
            "has_audio": bool(r.audio_path),
            "has_transcript": bool(r.transcript_text),
            "has_summary": bool(r.summary_text),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return {"records": data}


@router.get("/records/{record_id}")
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    r = db.query(TranscriptRecord).filter(
        TranscriptRecord.id == record_id, TranscriptRecord.user_id == current_user.get("user_id")
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    return {
        "id": r.id,
        "patient_name": r.patient_name,
        "age": r.age,
        "bed_no": r.bed_no,
        "phone_no": r.phone_no,
        "visit_date": r.visit_date.isoformat() if r.visit_date else None,
        "audio_path": r.audio_path,
        "transcript_text": r.transcript_text,
        "summary_text": r.summary_text,
        "dynamic_fields": r.dynamic_fields or {},
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }

