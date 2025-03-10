from fastapi import  HTTPException, UploadFile
from app.vector_db import retrieve_similar_docs, add_document
import pdfplumber 
from typing import Union

def extract_text_from_pdf(pdf_file):
    """Extracts text from a PDF file using pdfplumber."""
    try:
        with pdfplumber.open(pdf_file) as pdf:
            text = "\n".join([page.extract_text() or "" for page in pdf.pages])
        return text.strip() if text.strip() else None  # Remove empty text
    except Exception as e:
        print(f"⚠️ Error extracting PDF text: {e}")
        return None
    
async def extract_text_from_file(file) -> Union[str, None]:
    """Extracts text from a file (TXT or PDF)."""
    file_extension = file.filename.split(".")[-1].lower()

    if file_extension == "txt":
        content = await file.read()
        text = content.decode("utf-8")
    elif file_extension == "pdf":
        text = extract_text_from_pdf(file.file)
    else:
        raise HTTPException(status_code=400, detail="Only TXT and PDF files are supported.")

    return text


def validate_and_store_text_in_ChromaDB(text: str, bot_id: int, file) -> None:
    """Validates extracted text and stores it in ChromaDB."""
    if not text:
        raise HTTPException(status_code=400, detail="No extractable text found in the file.")

    # Store extracted text in ChromaDB
    add_document(bot_id, text, {"id": file.filename})


