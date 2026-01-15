from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import os
import uuid
import requests
import time
from datetime import datetime

from app.database import get_db
from app.dependency import get_current_user
from app.models import TranscriptRecord, User
from app.utils.file_storage import save_file, get_file_url, FileStorageError
from app.utils.file_storage import resolve_file_url
from app.llm_manager import LLMManager
from app.vector_db import add_transcript_embedding_to_qdrant, retrieve_transcript_context, add_field_answer_embedding_to_qdrant, retrieve_transcript_context_by_patient
from app.word_count_validation import extract_text as extract_text_from_upload

router = APIRouter(prefix="/transcript", tags=["Transcript Project"])

TRANSCRIPT_DIR = "transcript_project"


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

def _generate_pid() -> str:
    return f"P{uuid.uuid4().hex[:8]}".upper()


@router.post("/records")
def create_record(
    data: Dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new transcript record with patient info.
    """
    p_id = data.get("p_id") or _generate_pid()

    record = TranscriptRecord(
        user_id=current_user.get("user_id"),
        p_id=p_id,
        medical_clinic=data.get("medical_clinic"),
        age=data.get("age"),
        bed_no=data.get("bed_no"),
        phone_no=data.get("phone_no"),
        visit_date=datetime.fromisoformat(data["visit_date"]) if data.get("visit_date") else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"record_id": record.id, "p_id": record.p_id}


@router.post("/records/{record_id}/audio")
async def upload_audio(
    record_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload recorded or pre-recorded audio for the record.
    Stores under transcript_project/ and returns a resolvable URL/path.
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
        # Build a usable URL for browser playback
        base_url = os.getenv("SERVER_URL")
        rel_url = f"/{TRANSCRIPT_DIR}/{os.path.basename(saved_path)}"
        file_url = None
        try:
            file_url = get_file_url(TRANSCRIPT_DIR, filename, base_url)  # may raise if base_url missing
        except Exception:
            file_url = None
        resolved_url = resolve_file_url(file_url) if file_url and file_url.startswith("s3://") else (file_url or (base_url.rstrip("/") + rel_url if base_url else rel_url))
    except FileStorageError as e:
        raise HTTPException(status_code=500, detail=f"File storage error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error saving audio: {str(e)}")

    record.audio_path = saved_path  # store raw path (consistent with avatar handling)
    db.commit()

    return {"audio_path": saved_path, "url": resolved_url}


@router.post("/records/{record_id}/document")
async def upload_document(
    record_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a document (pdf, docx, doc, txt, csv, png, jpg, jpeg) and extract text into transcript_text.
    Stores the raw file under transcript_project/ and indexes extracted text into Qdrant.
    """
    record = db.query(TranscriptRecord).filter(
        TranscriptRecord.id == record_id, TranscriptRecord.user_id == current_user.get("user_id")
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    # Save original document (optional)
    ext = (file.filename or "document").split(".")[-1].lower()
    safe_name = f"{uuid.uuid4()}.{ext}"
    try:
        content = await file.read()
        saved_path = save_file(TRANSCRIPT_DIR, safe_name, content)
        base_url = os.getenv("SERVER_URL")
        rel_url = f"/{TRANSCRIPT_DIR}/{os.path.basename(saved_path)}"
        file_url = None
        try:
            file_url = get_file_url(TRANSCRIPT_DIR, safe_name, base_url)
        except Exception:
            file_url = None
        resolved_url = resolve_file_url(file_url) if file_url and file_url.startswith("s3://") else (file_url or (base_url.rstrip("/") + rel_url if base_url else rel_url))
    except FileStorageError as e:
        raise HTTPException(status_code=500, detail=f"File storage error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error saving document: {str(e)}")

    # Reconstruct an UploadFile-like object for extractor
    from starlette.datastructures import UploadFile as StarletteUploadFile
    doc_upload = StarletteUploadFile(filename=file.filename or safe_name, file=os.path.join(TRANSCRIPT_DIR, os.path.basename(saved_path)))

    # Use Evolra's unified extractor
    try:
        # We need an UploadFile with .read(); provide a fresh one from saved bytes
        class _MemUF:
            def __init__(self, name:str, data:bytes):
                self.filename = name
                self._data = data
                self._pos = 0
            async def read(self):
                return self._data
            async def seek(self, pos:int):
                self._pos = pos
        mem_file = _MemUF(file.filename or safe_name, content)
        text = await extract_text_from_upload(mem_file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not extract text: {str(e)}")

    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="No readable text found in document")

    # Save as transcript and index
    record.transcript_text = text.strip()
    db.commit()

    try:
        visit_iso = record.visit_date.isoformat() if record.visit_date else None
        add_transcript_embedding_to_qdrant(record.id, current_user.get("user_id"), record.transcript_text, model="text-embedding-3-large", p_id=record.p_id, visit_date=visit_iso)
    except Exception:
        pass

    return {"transcript": record.transcript_text, "path": saved_path, "url": resolved_url}

def _assemblyai_transcribe(local_path: str) -> str:
    """
    Transcribe audio using AssemblyAI API.
    Requires env ASSEMBLYAI_API_KEY.
    Returns transcribed text or raises exception on failure.
    """
    print("[TRANSCRIPTION] Attempting transcription with AssemblyAI...")
    api_key = os.getenv("ASSEMBLYAI_API_KEY")
    if not api_key:
        print("[TRANSCRIPTION] ASSEMBLYAI_API_KEY not found in environment variables")
        raise ValueError("ASSEMBLYAI_API_KEY not configured")

    # Step 1: Upload the audio file
    # AssemblyAI requires raw binary data with Content-Type: application/octet-stream
    upload_url = "https://api.assemblyai.com/v2/upload"
    headers = {
        "authorization": api_key,
        "Content-Type": "application/octet-stream"
    }
    
    filename = os.path.basename(local_path)
    file_ext = os.path.splitext(local_path)[1].lower()
    print(f"[TRANSCRIPTION] Uploading audio file to AssemblyAI: {local_path}")
    print(f"[TRANSCRIPTION] File extension: {file_ext}, filename: {filename}")
    
    try:
        # Read file as binary data
        with open(local_path, "rb") as f:
            file_data = f.read()
        
        file_size = len(file_data)
        print(f"[TRANSCRIPTION] File size: {file_size} bytes")
        
        if file_size == 0:
            error_msg = "Audio file is empty"
            print(f"[TRANSCRIPTION] ERROR: {error_msg}")
            raise ValueError(error_msg)
        
        # Send raw binary data (not multipart/form-data)
        upload_response = requests.post(upload_url, headers=headers, data=file_data, timeout=300)
        if upload_response.status_code >= 400:
            error_msg = f"AssemblyAI upload failed: {upload_response.text}"
            print(f"[TRANSCRIPTION] ERROR: {error_msg}")
            raise ValueError(error_msg)
        upload_data = upload_response.json()
        audio_url = upload_data.get("upload_url")
        if not audio_url:
            error_msg = "AssemblyAI upload did not return upload_url"
            print(f"[TRANSCRIPTION] ERROR: {error_msg}")
            raise ValueError(error_msg)
    except Exception as e:
        print(f"[TRANSCRIPTION] ERROR: Failed to upload to AssemblyAI: {str(e)}")
        raise

    print(f"[TRANSCRIPTION] Audio uploaded successfully. Upload URL: {audio_url}")

    # Step 2: Submit transcription job
    transcript_url = "https://api.assemblyai.com/v2/transcript"
    transcript_request = {
        "audio_url": audio_url,
        "language_code": "en"  # Can be made configurable if needed
    }
    
    print("[TRANSCRIPTION] Submitting transcription job to AssemblyAI...")
    try:
        transcript_response = requests.post(transcript_url, json=transcript_request, headers=headers, timeout=300)
        if transcript_response.status_code >= 400:
            error_msg = f"AssemblyAI transcription submission failed: {transcript_response.text}"
            print(f"[TRANSCRIPTION] ERROR: {error_msg}")
            raise ValueError(error_msg)
        transcript_data = transcript_response.json()
        transcript_id = transcript_data.get("id")
        if not transcript_id:
            error_msg = "AssemblyAI did not return transcript ID"
            print(f"[TRANSCRIPTION] ERROR: {error_msg}")
            raise ValueError(error_msg)
    except Exception as e:
        print(f"[TRANSCRIPTION] ERROR: Failed to submit transcription job: {str(e)}")
        raise

    print(f"[TRANSCRIPTION] Transcription job submitted. Transcript ID: {transcript_id}")

    # Step 3: Poll for completion
    polling_url = f"https://api.assemblyai.com/v2/transcript/{transcript_id}"
    max_polls = 60  # Maximum number of polling attempts
    poll_interval = 3  # Seconds between polls
    
    print("[TRANSCRIPTION] Polling for transcription completion...")
    for i in range(max_polls):
        try:
            polling_response = requests.get(polling_url, headers=headers, timeout=300)
            if polling_response.status_code >= 400:
                error_msg = f"AssemblyAI polling failed: {polling_response.text}"
                print(f"[TRANSCRIPTION] ERROR: {error_msg}")
                raise ValueError(error_msg)
            
            status_data = polling_response.json()
            status = status_data.get("status")
            
            if status == "completed":
                transcript_text = status_data.get("text", "")
                if transcript_text:
                    print(f"[TRANSCRIPTION] SUCCESS: Transcription completed using AssemblyAI")
                    print(f"[TRANSCRIPTION] Transcript length: {len(transcript_text)} characters")
                    return transcript_text
                else:
                    error_msg = "AssemblyAI returned empty transcript"
                    print(f"[TRANSCRIPTION] ERROR: {error_msg}")
                    raise ValueError(error_msg)
            elif status == "error":
                error_msg = status_data.get("error", "Unknown error from AssemblyAI")
                print(f"[TRANSCRIPTION] ERROR: AssemblyAI transcription failed: {error_msg}")
                raise ValueError(f"AssemblyAI transcription error: {error_msg}")
            else:
                # Status is "queued" or "processing"
                if i % 5 == 0:  # Print every 5th poll to avoid spam
                    print(f"[TRANSCRIPTION] Status: {status} (poll {i+1}/{max_polls})")
        except ValueError:
            raise  # Re-raise ValueError (our custom errors)
        except Exception as e:
            print(f"[TRANSCRIPTION] ERROR: Exception during polling: {str(e)}")
            raise
        
        time.sleep(poll_interval)
    
    # If we get here, polling timed out
    error_msg = f"AssemblyAI transcription timed out after {max_polls * poll_interval} seconds"
    print(f"[TRANSCRIPTION] ERROR: {error_msg}")
    raise ValueError(error_msg)


def _openai_transcribe(local_path: str) -> str:
    """
    Minimal OpenAI Whisper transcription via REST to avoid new SDK dependency.
    Requires env OPENAI_API_KEY.
    """
    print("[TRANSCRIPTION] Attempting transcription with OpenAI Whisper...")
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY")
    if not api_key:
        print("[TRANSCRIPTION] OPENAI_API_KEY not found in environment variables")
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    url = "https://api.openai.com/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {api_key}"}

    # Prefer whisper-1 for broad availability; allow override
    model = os.getenv("OPENAI_TRANSCRIBE_MODEL", "whisper-1")
    print(f"[TRANSCRIPTION] Using Whisper model: {model}")

    try:
        with open(local_path, "rb") as f:
            files = {
                "file": (os.path.basename(local_path), f, "application/octet-stream"),
            }
            data = {"model": model, "temperature": "0"}
            print(f"[TRANSCRIPTION] Sending audio file to OpenAI Whisper API...")
            resp = requests.post(url, headers=headers, files=files, data=data, timeout=300)
            if resp.status_code >= 400:
                error_msg = f"OpenAI transcription failed: {resp.text}"
                print(f"[TRANSCRIPTION] ERROR: {error_msg}")
                raise HTTPException(status_code=500, detail=error_msg)
            out = resp.json()
            transcript_text = out.get("text", "")
            if transcript_text:
                print(f"[TRANSCRIPTION] SUCCESS: Transcription completed using OpenAI Whisper")
                print(f"[TRANSCRIPTION] Transcript length: {len(transcript_text)} characters")
            else:
                print(f"[TRANSCRIPTION] WARNING: OpenAI Whisper returned empty transcript")
            return transcript_text
    except HTTPException:
        raise  # Re-raise HTTPException
    except Exception as e:
        error_msg = f"OpenAI Whisper transcription error: {str(e)}"
        print(f"[TRANSCRIPTION] ERROR: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/records/{record_id}/transcribe")
def transcribe_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Transcribe the uploaded audio using AssemblyAI first, with fallback to OpenAI Whisper.
    For users with transcript_access role.
    """
    print(f"[TRANSCRIPTION] Starting transcription for record_id: {record_id}, user_id: {current_user.get('user_id')}")
    
    record = db.query(TranscriptRecord).filter(
        TranscriptRecord.id == record_id, TranscriptRecord.user_id == current_user.get("user_id")
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if not record.audio_path:
        raise HTTPException(status_code=400, detail="No audio uploaded for this record")

    # If stored path is s3:// not supported here; assume local path under transcript_project
    local_path = record.audio_path if os.path.isabs(record.audio_path) else os.path.join(TRANSCRIPT_DIR, os.path.basename(record.audio_path))
    if not os.path.exists(local_path):
        # try direct relative
        local_path = record.audio_path
    if not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="Stored audio file not found")

    print(f"[TRANSCRIPTION] Audio file found at: {local_path}")
    
    # Try AssemblyAI first, fallback to Whisper
    text = None
    transcription_service = None
    
    try:
        print("[TRANSCRIPTION] ========================================")
        print("[TRANSCRIPTION] PRIMARY: Attempting AssemblyAI transcription")
        print("[TRANSCRIPTION] ========================================")
        text = _assemblyai_transcribe(local_path)
        transcription_service = "AssemblyAI"
        print(f"[TRANSCRIPTION] ========================================")
        print(f"[TRANSCRIPTION] FINAL RESULT: Transcription completed using {transcription_service}")
        print(f"[TRANSCRIPTION] ========================================")
    except Exception as assembly_error:
        print(f"[TRANSCRIPTION] ========================================")
        print(f"[TRANSCRIPTION] AssemblyAI failed: {str(assembly_error)}")
        print(f"[TRANSCRIPTION] FALLBACK: Attempting OpenAI Whisper transcription")
        print(f"[TRANSCRIPTION] ========================================")
        
        try:
            text = _openai_transcribe(local_path)
            transcription_service = "OpenAI Whisper"
            print(f"[TRANSCRIPTION] ========================================")
            print(f"[TRANSCRIPTION] FINAL RESULT: Transcription completed using {transcription_service}")
            print(f"[TRANSCRIPTION] ========================================")
        except Exception as whisper_error:
            print(f"[TRANSCRIPTION] ========================================")
            print(f"[TRANSCRIPTION] ERROR: Both AssemblyAI and Whisper failed")
            print(f"[TRANSCRIPTION] AssemblyAI error: {str(assembly_error)}")
            print(f"[TRANSCRIPTION] Whisper error: {str(whisper_error)}")
            print(f"[TRANSCRIPTION] ========================================")
            raise HTTPException(
                status_code=500,
                detail=f"Transcription failed with both services. AssemblyAI: {str(assembly_error)}. Whisper: {str(whisper_error)}"
            )
    
    if not text or not text.strip():
        print(f"[TRANSCRIPTION] WARNING: Transcription returned empty text")
        raise HTTPException(status_code=500, detail="Transcription returned empty result")
    
    record.transcript_text = text
    db.commit()
    print(f"[TRANSCRIPTION] Transcript saved to database for record_id: {record_id}")

    # Index transcript into Qdrant
    try:
        visit_iso = record.visit_date.isoformat() if record.visit_date else None
        add_transcript_embedding_to_qdrant(record.id, current_user.get("user_id"), text, model="text-embedding-3-large", p_id=record.p_id, visit_date=visit_iso)
        print(f"[TRANSCRIPTION] Transcript indexed into Qdrant vector database")
    except Exception as e:
        # Don't fail the request if indexing fails
        print(f"[TRANSCRIPTION] WARNING: Failed to index transcript into Qdrant: {str(e)}")
        pass

    return {"transcript": text, "service_used": transcription_service}


@router.put("/records/{record_id}/transcript")
def update_transcript_text(
    record_id: int,
    payload: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Update the transcript text manually edited by the user.
    Re-index the updated transcript into Qdrant for improved retrieval.
    """
    record = db.query(TranscriptRecord).filter(
        TranscriptRecord.id == record_id, TranscriptRecord.user_id == current_user.get("user_id")
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    new_text = (payload.get("transcript") or "").strip()
    record.transcript_text = new_text
    db.commit()

    # Re-index updated transcript
    try:
        visit_iso = record.visit_date.isoformat() if record.visit_date else None
        add_transcript_embedding_to_qdrant(record.id, current_user.get("user_id"), new_text, model="text-embedding-3-large", p_id=record.p_id, visit_date=visit_iso)
    except Exception:
        pass

    return {"ok": True}

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

    # Use the full transcript text directly (no vector retrieval)
    context = (record.transcript_text or "")
    if not context.strip():
        raise HTTPException(status_code=400, detail="No transcript available to summarize")

    # Use OpenAI 4o mini specifically for transcript project (does not affect Evolra bots)
    llm = LLMManager(model_name="gpt-4o-mini", bot_id=None, user_id=current_user.get("user_id"), unanswered_message="")
    user_message = (
        "You are a helpful summarizer.\n\n"
        "Task:\n"
        "- If the text is a medical consultation, produce concise clinical notes with headings:\n"
        "  Complaint, History, Exam, Assessment, Plan.\n"
        "- If the text is not a medical consultation (e.g., sports/news/general content), write a clear paragraph summary followed by 3-6 bullet key points.\n"
        "- Be robust to missing explicit keywords; infer sensible information from statements. If symptoms imply a provisional diagnosis, include it.\n"
        "- Never reply with 'I don't know' or generic apologies. Always return a best-effort summary from the provided text.\n"
        "- Do NOT include any 'Provenance' or sources section.\n"
        "- Output only the summary content (no extra commentary)."
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
            visit_iso = record.visit_date.isoformat() if record.visit_date else None
            add_field_answer_embedding_to_qdrant(record.id, current_user.get("user_id"), label, ans, model="text-embedding-3-large", p_id=record.p_id, visit_date=visit_iso)
        except Exception:
            pass

    # persist
    record.dynamic_fields = {**(record.dynamic_fields or {}), **answers}
    db.commit()

    return {"fields": answers}


@router.post("/records/{record_id}/chat")
def qna_chat(
    record_id: int,
    payload: Dict[str, List[Dict[str, str]] | str],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Patient-level QnA over embedded transcript/dynamic-field chunks.
    payload: { "question": str, "history": [{"role":"user|assistant","content":"..."}] }
    """
    question: str = (payload.get("question") or "").strip()
    history: List[Dict[str, str]] = payload.get("history") or []
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    record = db.query(TranscriptRecord).filter(
        TranscriptRecord.id == record_id, TranscriptRecord.user_id == current_user.get("user_id")
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    # Parse a loose date hint from the question (YYYY-MM-DD or '12 Nov 25/2025')
    import re
    visit_hint = None
    m1 = re.search(r"(20\\d{2}-\\d{2}-\\d{2})", question)
    if m1:
        visit_hint = m1.group(1)
    else:
        m2 = re.search(r"(\\d{1,2}\\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s*\\d{2,4})", question, flags=re.IGNORECASE)
        if m2:
            try:
                from datetime import datetime
                visit_hint = datetime.strptime(m2.group(1), "%d %b %y").date().isoformat()
            except Exception:
                try:
                    visit_hint = datetime.strptime(m2.group(1), "%d %b %Y").date().isoformat()
                except Exception:
                    visit_hint = None

    retrieved = retrieve_transcript_context_by_patient(record.p_id, question, visit_date=visit_hint, top_k=6, model="text-embedding-3-large")
    context_parts = []
    if retrieved:
        context_parts.append("Retrieved Notes:\n" + retrieved)
    if record.transcript_text:
        context_parts.append("Current Visit Transcript:\n" + (record.transcript_text or ""))
    context = "\n\n".join(context_parts).strip()

    # Build compact history
    hist_lines = []
    for msg in (history or [])[-6:]:
        role = msg.get("role", "user")
        content = (msg.get("content") or "").strip()
        if content:
            hist_lines.append(f"{role}: {content}")
    hist_text = "\n".join(hist_lines)

    llm = LLMManager(model_name="gpt-4o-mini", bot_id=None, user_id=current_user.get("user_id"), unanswered_message="Not specified")
    system = (
        "You are a clinical QnA assistant for a single patient. Answer strictly from the provided notes.\n"
        "- If the question references a date, prioritize notes from that visit.\n"
        "- If the answer is not in the notes, reply exactly: Not specified.\n"
        "- Be concise and clinically precise."
    )
    full_context = f"{system}\n\nChat History:\n{hist_text}\n\n{context}\n\nQuestion: {question}"
    result = llm.generate(context=full_context, user_message="Answer the question above.", use_external_knowledge=False, temperature=0.2)
    answer = result["message"] if isinstance(result, dict) and "message" in result else (result if isinstance(result, str) else "Not specified")
    answer = _sanitize = _strip_provenance_block((answer or "").strip())
    return {"answer": answer}

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
            "p_id": r.p_id,
            "patient_email": r.patient_email,
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
        "p_id": r.p_id,
        "medical_clinic": r.medical_clinic,
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


@router.get("/patients")
def list_patients(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    rows = (
        db.query(TranscriptRecord)
        .filter(TranscriptRecord.user_id == current_user.get("user_id"))
        .order_by(TranscriptRecord.visit_date.desc().nullslast(), TranscriptRecord.created_at.desc())
        .all()
    )
    grouped: Dict[str, Dict] = {}
    for r in rows:
        g = grouped.setdefault(
            r.p_id,
            {
                "p_id": r.p_id,
                "medical_clinic": None,
                "phone_no": None,
                "age": None,
                "bed_no": None,
                "visits": [],
            },
        )
        # Capture representative demographics from the most recent row
        if g["age"] is None and r.age is not None:
            g["age"] = r.age
        if g["bed_no"] is None and r.bed_no:
            g["bed_no"] = r.bed_no
        if g["medical_clinic"] is None and r.medical_clinic:
            g["medical_clinic"] = r.medical_clinic
        if g["phone_no"] is None and r.phone_no:
            g["phone_no"] = r.phone_no
        g["visits"].append({
            "id": r.id,
            "visit_date": r.visit_date.isoformat() if r.visit_date else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "has_transcript": bool(r.transcript_text),
            "has_summary": bool(r.summary_text),
        })
    # order visits
    for g in grouped.values():
        g["visits"].sort(key=lambda v: (v["visit_date"] or v["created_at"] or ""), reverse=True)
    return {"patients": list(grouped.values())}


@router.get("/patients/search")
def search_patients(
    q: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q_like = f"%{q}%"
    rows = (
        db.query(TranscriptRecord)
        .filter(
            TranscriptRecord.user_id == current_user.get("user_id"),
            (TranscriptRecord.p_id.ilike(q_like) | TranscriptRecord.phone_no.ilike(q_like) | TranscriptRecord.medical_clinic.ilike(q_like))
        )
        .order_by(TranscriptRecord.created_at.desc())
        .all()
    )
    grouped: Dict[str, Dict] = {}
    for r in rows:
        g = grouped.setdefault(
            r.p_id,
            {
                "p_id": r.p_id,
                "medical_clinic": None,
                "phone_no": None,
                "age": None,
                "bed_no": None,
                "visits": [],
            },
        )
        if g["age"] is None and r.age is not None:
            g["age"] = r.age
        if g["bed_no"] is None and r.bed_no:
            g["bed_no"] = r.bed_no
        if g["medical_clinic"] is None and r.medical_clinic:
            g["medical_clinic"] = r.medical_clinic
        if g["phone_no"] is None and r.phone_no:
            g["phone_no"] = r.phone_no
        g["visits"].append({"id": r.id, "visit_date": r.visit_date.isoformat() if r.visit_date else None, "created_at": r.created_at.isoformat() if r.created_at else None})
    return {"patients": list(grouped.values())}

