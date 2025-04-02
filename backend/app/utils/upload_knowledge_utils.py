from fastapi import  HTTPException, UploadFile
from app.vector_db import retrieve_similar_docs, add_document
import pdfplumber 
from typing import Union
import io
import asyncio
import os

def extract_text_from_pdf(pdf_file):
    """Extracts text from a PDF file using pdfplumber."""
    try:
        with pdfplumber.open(pdf_file) as pdf:
            text = "\n".join([page.extract_text() or "" for page in pdf.pages])
        return text.strip() if text.strip() else None  # Remove empty text
    except Exception as e:
        print(f"⚠️ Error extracting PDF text: {e}")
        return None
    
async def extract_text_from_file(file, filename=None) -> Union[str, None]:
    """
    Extracts text from a file (TXT or PDF).
    
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
                print(f"⚠️ No filename provided and file object has no filename attribute")
                raise ValueError("Filename must be provided when file does not have filename attribute")
        
        print(f"📄 Extracting text from file: {filename}")
        
        # Get file extension
        file_extension = filename.split(".")[-1].lower()
        print(f"📋 File extension: {file_extension}")

        if file_extension == "txt":
            print("📝 Processing as TXT file")
            # Handle different types of input files
            if isinstance(file, bytes):
                # If file is already bytes content
                print("🔄 File is bytes content")
                content = file
            elif hasattr(file, 'read'):
                # If file is a file-like object
                print("🔄 File is a file-like object")
                if callable(getattr(file, 'read')) and asyncio.iscoroutinefunction(file.read):
                    print("🔄 Reading file asynchronously")
                    content = await file.read()
                else:
                    print("🔄 Reading file synchronously")
                    content = file.read()
            else:
                print(f"❌ Unsupported file type: {type(file)}")
                raise TypeError(f"File must be bytes or have a read() method. Got {type(file)}")
                
            text = content.decode("utf-8")
            print(f"✅ Successfully extracted text from TXT file (length: {len(text)})")
            return text
            
        elif file_extension == "pdf":
            print("📄 Processing as PDF file")
            # For PDF, we need a file-like object
            if isinstance(file, bytes):
                # Convert bytes to file-like object
                print("🔄 Converting bytes to file-like object")
                file_obj = io.BytesIO(file)
            elif hasattr(file, 'read'):
                # If we have a read method, use it to get content
                if asyncio.iscoroutinefunction(getattr(file, 'read')):
                    print("🔄 Reading PDF file asynchronously")
                    content = await file.read()
                    file_obj = io.BytesIO(content)
                else:
                    # Use the file's 'file' attribute or the file itself
                    print("🔄 Using file object directly")
                    file_obj = getattr(file, 'file', file)
            else:
                print(f"❌ Unsupported PDF file type: {type(file)}")
                raise TypeError(f"Cannot process PDF from the provided file type: {type(file)}")
                
            text = extract_text_from_pdf(file_obj)
            if text:
                print(f"✅ Successfully extracted text from PDF file (length: {len(text)})")
            else:
                print("⚠️ No text extracted from PDF file")
            return text
            
        else:
            print(f"❌ Unsupported file extension: {file_extension}")
            raise HTTPException(status_code=400, detail=f"File format '{file_extension}' is not supported. Only TXT and PDF files are supported.")

    except Exception as e:
        print(f"❌ Error extracting text from file {filename if filename else 'unknown'}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error extracting text: {str(e)}")


def validate_and_store_text_in_ChromaDB(text: str, bot_id: int, file) -> None:
    """Validates extracted text and stores it in ChromaDB."""
    if not text:
        print(f"⚠️ No extractable text found in the file: {file.filename}")
        raise HTTPException(status_code=400, detail="No extractable text found in the file.")

    # Create a more complete metadata object
    metadata = {
        "id": getattr(file, 'filename', 'unknown'),
        "file_type": getattr(file, 'content_type', os.path.splitext(file.filename)[1] if hasattr(file, 'filename') else 'unknown'),
        "file_name": getattr(file, 'filename', 'unknown')
    }
    
    # Store extracted text in ChromaDB
    print(f"💾 Storing document in ChromaDB for bot {bot_id}: {metadata['id']}")
    add_document(bot_id, text, metadata)


