import fitz 
import pytesseract
from PIL import Image
import io
import tempfile
import os
from fastapi import UploadFile, File, APIRouter, HTTPException, status
from typing import Dict, Any, List
from docx import Document
import zipfile
import pandas as pd

router = APIRouter()

# Configuration constants
MAX_WORD_COUNT = 50000  
SUPPORTED_FILE_TYPES = {
    "pdf", "txt", "doc", "docx", "csv", "png", "jpg", "jpeg"
}

async def extract_text_from_image(image_bytes: bytes) -> str:
    """Extract text from image using OCR"""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(image)
    except Exception as e:
        print(f"OCR Error: {str(e)}")
        return ""

## PDF Processing ##
async def extract_text_from_pdf(pdf: UploadFile) -> str:
    """Extract text from PDF pages"""
    try:
        pdf_data = await pdf.read()
        doc = fitz.open(stream=pdf_data, filetype="pdf")
        return " ".join(page.get_text("text") for page in doc)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"PDF text extraction error: {str(e)}"
        )

async def extract_text_from_pdf_images(pdf: UploadFile) -> str:
    """Extract text from PDF images"""
    try:
        pdf_data = await pdf.read()
        doc = fitz.open(stream=pdf_data, filetype="pdf")
        extracted_text = ""
        
        for page in doc:
            for img in page.get_images(full=True):
                xref = img[0]
                base_image = doc.extract_image(xref)
                extracted_text += await extract_text_from_image(base_image["image"]) + " "
        
        return extracted_text
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"PDF image extraction error: {str(e)}"
        )

## DOCX Processing ##
async def extract_text_from_docx(docx: UploadFile) -> str:
    """Extract text from DOCX paragraphs"""
    try:
        docx_data = await docx.read()
        doc = Document(io.BytesIO(docx_data))
        return " ".join([para.text for para in doc.paragraphs])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"DOCX text extraction error: {str(e)}"
        )

async def extract_text_from_docx_images(docx: UploadFile) -> str:
    """Extract text from DOCX images"""
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp_file:
            content = await docx.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        extracted_text = ""

        with zipfile.ZipFile(temp_path, "r") as docx_zip:
            for file_name in docx_zip.namelist():
                if file_name.startswith("word/media/") and file_name.lower().endswith((".png", ".jpg", ".jpeg")):
                    with docx_zip.open(file_name) as image_file:
                        extracted_text += await extract_text_from_image(image_file.read()) + " "
        
        return extracted_text.strip()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"DOCX image extraction error: {str(e)}"
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

## TXT Processing ##
async def extract_text_from_txt(txt: UploadFile) -> str:
    """Extract text from plain text files"""
    try:
        return (await txt.read()).decode('utf-8')
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Text file error: {str(e)}"
        )

## CSV Processing ##
async def extract_text_from_csv(csv: UploadFile) -> str:
    """Extract text from CSV files"""
    try:
        contents = await csv.read()
        df = pd.read_csv(io.BytesIO(contents))
        return df.to_string()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV processing error: {str(e)}"
        )

## Image Processing ##
async def extract_text_from_image_file(image: UploadFile) -> str:
    """Process direct image uploads"""
    try:
        return await extract_text_from_image(await image.read())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image processing error: {str(e)}"
        )

def count_words_and_chars(text: str) -> tuple[int, int]:
    """Count words and characters in text"""
    words = [word for word in text.split() if word.strip()]
    return len(words), len(text)

async def extract_text(file: UploadFile) -> str:
    """Unified text extraction based on file type"""
    file_ext = file.filename.split(".")[-1].lower()
    
    if file_ext == "pdf":
        text = await extract_text_from_pdf(file)
        await file.seek(0)
        return text + " " + await extract_text_from_pdf_images(file)
    elif file_ext == "docx":
        text = await extract_text_from_docx(file)
        await file.seek(0)
        return text + " " + await extract_text_from_docx_images(file)
    elif file_ext == "txt":
        return await extract_text_from_txt(file)
    elif file_ext == "csv":
        return await extract_text_from_csv(file)
    elif file_ext in ("png", "jpg", "jpeg"):
        return await extract_text_from_image_file(file)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.filename}"
        )

@router.post("/word_count/", response_model=List[Dict[str, Any]])
async def word_count_endpoint(files: List[UploadFile] = File(...)) -> List[Dict[str, Any]]:
    """
    Process files and return word/character counts with validation
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided"
        )

    results = []
    
    for file in files:
        try:
            # Extract text
            text = await extract_text(file)
            word_count, char_count = count_words_and_chars(text)

            # Validate word count
            if word_count > MAX_WORD_COUNT:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File exceeds {MAX_WORD_COUNT} word limit"
                )

            results.append({
                "file_name": file.filename,
                "word_count": word_count,
                "character_count": char_count,
                "text_sample": text[:200] + "..." if len(text) > 200 else text
            })

        except HTTPException as he:
            results.append({
                "file_name": file.filename,
                "error": str(he.detail),
                "exceeds_limit": True
            })
        except Exception as e:
            results.append({
                "file_name": file.filename,
                "error": f"Processing error: {str(e)}"
            })

    return results