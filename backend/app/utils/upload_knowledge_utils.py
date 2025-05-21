from fastapi import HTTPException, UploadFile
from app.vector_db import retrieve_similar_docs, add_document
import pdfplumber 
from typing import Union, List, Dict
import io
import asyncio
import os
import fitz 
import pytesseract
from PIL import Image
import tempfile
import zipfile
from docx import Document
import logging
from app.utils.logger import get_module_logger
from langchain_text_splitters import RecursiveCharacterTextSplitter
import tiktoken

# Create a logger for this module
logger = get_module_logger(__name__)

def extract_text_from_pdf(pdf_file):
    """Extracts text from a PDF file using pdfplumber."""
    try:
        with pdfplumber.open(pdf_file) as pdf:
            text = "\n".join([page.extract_text() or "" for page in pdf.pages])
        return text.strip() if text.strip() else None
    except Exception as e:
        logger.warning(f"⚠️ Error extracting PDF text: {e}")
        return None

def extract_text_from_pdf_images(pdf_content: bytes) -> str:
    """Extracts text from images in a PDF using OCR."""
    try:
        extracted_text = ""
        doc = fitz.open(stream=pdf_content, filetype="pdf")
        
        for page in doc:
            for img in page.get_images(full=True):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image = Image.open(io.BytesIO(base_image["image"]))
                extracted_text += pytesseract.image_to_string(image) + " "
        
        return extracted_text.strip()
    except Exception as e:
        logger.warning(f"⚠️ Error extracting text from PDF images: {e}")
        return ""

def extract_text_from_image(image_bytes: bytes) -> str:
    """Extracts text from an image file using OCR."""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(image)
    except Exception as e:
        logger.warning(f"⚠️ Error extracting text from image: {e}")
        return ""

def extract_text_from_docx(docx_content: bytes) -> str:
    """Extracts text from a DOCX file."""
    try:
        doc = Document(io.BytesIO(docx_content))
        return " ".join([para.text for para in doc.paragraphs])
    except Exception as e:
        logger.warning(f"⚠️ Error extracting text from DOCX: {e}")
        return ""

def extract_text_from_docx_images(docx_content: bytes) -> str:
    """Extracts text from images within a DOCX file."""
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp_file:
            temp_file.write(docx_content)
            temp_path = temp_file.name
        
        extracted_text = ""
        
        with zipfile.ZipFile(temp_path, "r") as docx_zip:
            for file_name in docx_zip.namelist():
                if file_name.startswith("word/media/") and file_name.lower().endswith((".png", ".jpg", ".jpeg")):
                    with docx_zip.open(file_name) as image_file:
                        extracted_text += extract_text_from_image(image_file.read()) + " "
        
        return extracted_text.strip()
    except Exception as e:
        logger.warning(f"⚠️ Error extracting text from DOCX images: {e}")
        return ""
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

def extract_text_from_doc(doc_content: bytes) -> str:
    """Extracts text from older .doc files (requires antiword or similar tool)."""
    try:
        # This requires antiword to be installed on the system
        with tempfile.NamedTemporaryFile(delete=False, suffix=".doc") as temp_file:
            temp_file.write(doc_content)
            temp_path = temp_file.name
        
        # Using antiword to extract text from .doc files
        text = os.popen(f"antiword '{temp_path}'").read()
        return text.strip()
    except Exception as e:
        logger.warning(f"⚠️ Error extracting text from DOC file: {e}")
        return ""
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

async def extract_text_from_file(file, filename=None) -> Union[str, None]:
    """
    Extracts text from any supported file type (TXT, PDF, DOC, DOCX, PNG, JPG).
    
    Args:
        file: Either a file-like object with read() method or raw bytes content
        filename: If provided, used to determine file type, otherwise tries to use file.filename
    """
    try:
        # Determine filename either from parameter or file attribute
        if filename is None:
            if hasattr(file, 'filename'):
                filename = file.filename
            else:
                logger.warning("⚠️ No filename provided and file object has no filename attribute")
                raise ValueError("Filename must be provided when file does not have filename attribute")
        
        logger.info(f"📄 Extracting text from file: {filename}")
        
        # Get file extension
        file_extension = filename.split(".")[-1].lower()
        logger.info(f"📋 File extension: {file_extension}")

        # Get file content
        if isinstance(file, bytes):
            content = file
        elif hasattr(file, 'read'):
            if asyncio.iscoroutinefunction(getattr(file, 'read')):
                content = await file.read()
            else:
                content = file.read()
        else:
            raise TypeError(f"File must be bytes or have a read() method. Got {type(file)}")

        # Process based on file type
        if file_extension == "txt":
            logger.info("📝 Processing as TXT file")
            text = content.decode("utf-8")
            logger.info(f"✅ Successfully extracted text from TXT file (length: {len(text)})")
            return text
            
        elif file_extension == "pdf":
            logger.info("📄 Processing as PDF file")
            # First try regular text extraction
            file_obj = io.BytesIO(content)
            text = extract_text_from_pdf(file_obj)
            
            # If no text found or very little text, try OCR on images
            if not text or len(text.strip()) < 50:  # Arbitrary threshold
                logger.info("🔍 Trying OCR for possible image-based PDF")
                ocr_text = extract_text_from_pdf_images(content)
                text = (text + " " + ocr_text).strip() if text else ocr_text
            
            if text:
                logger.info(f"✅ Successfully extracted text from PDF file (length: {len(text)})")
            else:
                logger.warning("⚠️ No text extracted from PDF file")
            return text
            
        elif file_extension == "docx":
            logger.info("📝 Processing as DOCX file")
            text = extract_text_from_docx(content)
            ocr_text = extract_text_from_docx_images(content)
            combined_text = (text + " " + ocr_text).strip()
            logger.info(f"✅ Successfully extracted text from DOCX file (length: {len(combined_text)})")
            return combined_text
            
        elif file_extension == "doc":
            logger.info("📝 Processing as DOC file")
            text = extract_text_from_doc(content)
            logger.info(f"✅ Successfully extracted text from DOC file (length: {len(text)})")
            return text
            
        elif file_extension in ("png", "jpg", "jpeg"):
            logger.info("🖼️ Processing as image file")
            text = extract_text_from_image(content)
            logger.info(f"✅ Successfully extracted text from image file (length: {len(text)})")
            return text
            
        else:
            logger.error(f"❌ Unsupported file extension: {file_extension}")
            raise HTTPException(
                status_code=400, 
                detail=f"File format '{file_extension}' is not supported. Supported formats: TXT, PDF, DOC, DOCX, PNG, JPG."
            )

    except Exception as e:
        logger.error(f"❌ Error extracting text from file {filename if filename else 'unknown'}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error extracting text: {str(e)}")

def chunk_text(text: str, chunk_size: int = 3000, chunk_overlap: int = 200) -> List[str]:
    """
    Chunks text into smaller pieces suitable for embeddings.
    
    Args:
        text: The text to chunk
        chunk_size: Target size of each chunk in tokens
        chunk_overlap: Overlap between chunks in tokens
        
    Returns:
        List of text chunks
    """
    logger.info(f"🔪 Chunking text of length {len(text)} with chunk_size={chunk_size}, overlap={chunk_overlap}")
    
    try:
        # Initialize the text splitter
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=lambda text: len(tiktoken.get_encoding("cl100k_base").encode(text)),
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        # Split the text into chunks
        chunks = text_splitter.split_text(text)
        
        logger.info(f"✅ Successfully split text into {len(chunks)} chunks")
        return chunks
    
    except Exception as e:
        logger.warning(f"⚠️ Error chunking text: {e}")
        # If chunking fails, return the text as a single chunk
        logger.info("⚠️ Returning original text as single chunk")
        return [text]

def validate_and_store_text_in_ChromaDB(text: str, bot_id: int, file, user_id: int = None) -> None:
    """
    Validates extracted text and stores it in ChromaDB.
    
    Args:
        text: The text content to store
        bot_id: The bot ID
        file: The file object with metadata
        user_id: Optional user ID for model selection
    """
    if not text:
        logger.warning(f"⚠️ No extractable text found in the file: {file.filename}")
        raise HTTPException(status_code=400, detail="No extractable text found in the file.")

    # Create a more complete metadata object
    file_name = getattr(file, 'filename', 'unknown')
    file_type = getattr(file, 'content_type', os.path.splitext(file_name)[1] if hasattr(file, 'filename') else 'unknown')
    
    # Split text into chunks for embedding
    chunks = chunk_text(text)
    
    # Store each chunk with metadata
    for i, chunk in enumerate(chunks):
        chunk_metadata = {
            "id": f"{file_name}_{i}" if len(chunks) > 1 else file_name,
            "file_type": file_type,
            "file_name": file_name,
            "chunk_number": i + 1,
            "total_chunks": len(chunks)
        }
        
        # Store chunk in ChromaDB
        logger.info(f"💾 Storing chunk {i+1}/{len(chunks)} in ChromaDB for bot {bot_id}: {chunk_metadata['id']}")
        add_document(bot_id, chunk, chunk_metadata, user_id=user_id)