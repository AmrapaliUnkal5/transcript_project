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
from app.vector_db import add_transcript_embedding_to_qdrant, retrieve_transcript_context, add_field_answer_embedding_to_qdrant

router = APIRouter(prefix="/transcript", tags=["Transcript Project"])

TRANSCRIPT_DIR = "transcript_prject"


def _strip_provenance_block(text: str) -> str:
    """Remove any provenance/source blocks from model output."""
    if not text:
        return text
    import re
    # Remove any echoed [METADATA] lines
    text = re.sub(r"(?im)^\s*\[METADATA\][^\n]*\n?", "", text)
    # Remove from 'Provenance' (and common misspellings) to end
    cleaned = re.sub(
        r"(?is)"
        r"(?:\*{0,3}\s*)?"
        r"(?:provenance|provience|providence)"
        r"(?:\s*\*{0,3})?"
        r"\s*:?(?:\r?\n|\s|$)[\s\S]*$",
        "",
        text,
    ).rstrip()
    if cleaned != text:
        cleaned = re.sub(r"(?m)^[ \t]*\*[ \t]+", "• ", cleaned)
        return cleaned
    # Fallback: strip trailing 'source:' style lines
    lines = text.splitlines()
    i = len(lines) - 1
    while i >= 0:
        raw = lines[i].strip().lower()
        if raw.startswith("source:") or raw.startswith("file ") or raw.startswith("filename:"):
            i -= 1
        else:
            break
    return "\n".join(lines[: i + 1]).rstrip()

def _build_retrieval_query(label: str) -> str:
    """Expand a label into a richer retrieval query with synonyms/related terms."""
    l = (label or "").strip().lower()
    if l in ("diagnosis", "dx", "assessment", "impression"):
        return "diagnosis assessment impression condition likely cause problem diagnosis plan"
    if l in ("prescription", "medication", "rx", "treatment", "plan"):
        return "prescription medication meds drug treatment therapy plan dosage"
    if l in ("complaint", "chief complaint", "symptoms"):
        return "complaint chief complaint symptoms presenting problem issues"
    if l in ("history", "history of present illness", "hpi"):
        return "history HPI details background timeline"
    if l in ("exam", "examination", "findings"):
        return "exam examination findings physical exam observations"
    # default: include label and common medical terms
    return f"{label} medical notes clinical context details"

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

    # Index transcript into Qdrant
    try:
        add_transcript_embedding_to_qdrant(record.id, current_user.get("user_id"), text, model="text-embedding-3-large")
    except Exception as e:
        # Don't fail the request if indexing fails
        pass

    return {"transcript": text}


@router.post("/records/{record_id}/summarize")
def summarize_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Summarize transcript using retrieval from transcript_vector_store and LLMManager.
    """
    record = db.query(TranscriptRecord).filter(
        TranscriptRecord.id == record_id, TranscriptRecord.user_id == current_user.get("user_id")
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    # Retrieve context from vector store; fallback to raw transcript
    retrieved = retrieve_transcript_context(record.id, "Create a clinical summary for this consultation", top_k=6, model="text-embedding-3-large")
    context = retrieved if retrieved else (record.transcript_text or "")
    if not context.strip():
        raise HTTPException(status_code=400, detail="No transcript available to summarize")

    # Use OpenAI 4o mini specifically for transcript project (does not affect Evolra bots)
    llm = LLMManager(model_name="gpt-4o-mini", bot_id=None, user_id=current_user.get("user_id"), unanswered_message="")
    user_message = (
        "You are a medical assistant. Summarize the patient's consultation as concise clinical notes with headings:\n"
        "Complaint, History, Exam, Assessment, Plan.\n"
        "- Be robust to missing explicit keywords; infer clinically from statements. If symptoms imply a probable diagnosis, write a reasonable provisional diagnosis.\n"
        "- Do NOT include any 'Provenance' or sources section in the output."
    )
    result = llm.generate(context=context, user_message=user_message, use_external_knowledge=False, temperature=0.3)

    # llm.generate returns dict with "message" under many call sites; handle str fallback
    summary_text = result["message"] if isinstance(result, dict) and "message" in result else (result if isinstance(result, str) else "")
    summary_text = _strip_provenance_block(summary_text)
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
    Generate answers for user-defined fields using transcript vector retrieval as context.
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
    # Ensure there is at least some context available (either in vector store or raw)
    any_context = (record.transcript_text or "").strip()
    if not any_context:
        raise HTTPException(status_code=400, detail="No transcript available")

    # Use OpenAI 4o mini specifically for transcript project
    llm = LLMManager(model_name="gpt-4o-mini", bot_id=None, user_id=current_user.get("user_id"), unanswered_message="")

    # Use existing field answers to avoid re-answering and to provide context/history
    existing = record.dynamic_fields or {}
    existing_context_lines = []
    for k, v in existing.items():
        if v and isinstance(v, str) and v.strip():
            existing_context_lines.append(f"{k}: {v}")
    existing_context = "\n".join(existing_context_lines)

    answers: Dict[str, str] = {}
    for label in fields:
        # Skip if already answered with a non-empty value to save tokens
        if label in existing and isinstance(existing[label], str) and existing[label].strip() and existing[label].strip().lower() != "not specified.":
            continue

        # Retrieve focused context for each question (expanded query)
        retrieval_query = _build_retrieval_query(label)
        retrieved = retrieve_transcript_context(record.id, retrieval_query, top_k=6, model="text-embedding-3-large")
        transcript_context = retrieved if retrieved else (record.transcript_text or "")

        # Build final context including prior answers as history
        if existing_context:
            context = f"Known prior answers:\n{existing_context}\n\nTranscript context:\n{transcript_context}"
        else:
            context = transcript_context

        q = (
            f"You are a medical assistant.\n"
            f"Task: Provide ONLY the '{label}' succinctly based on the provided context.\n"
            f"- If explicit '{label}' is missing, infer a clinically sensible answer from symptoms and statements "
            f"(e.g., a plan implies prescription; symptoms can imply a provisional diagnosis).\n"
            f"- Return 'Not specified' only if it truly cannot be inferred from the context.\n"
            f"- Do NOT include any 'Provenance' or sources; output only the answer for '{label}'.\n"
        )
        res = llm.generate(context=context, user_message=q, use_external_knowledge=False, temperature=0.2)
        ans = res["message"] if isinstance(res, dict) and "message" in res else (res if isinstance(res, str) else "")
        ans = _strip_provenance_block(ans).strip()
        answers[label] = ans

        # Upsert this field answer as an embedding so future fields can retrieve it
        try:
            add_field_answer_embedding_to_qdrant(record.id, current_user.get("user_id"), label, ans, model="text-embedding-3-large")
        except Exception:
            pass

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

