import fitz 
import pytesseract
from PIL import Image
import io
import tempfile
import os
from fastapi import Body, UploadFile, File, APIRouter, HTTPException, status
from typing import Dict, Any, List
from docx import Document
import zipfile
import pandas as pd
from sqlalchemy import func
from app.dependency import get_current_user
from fastapi import Depends
from app.subscription_config import get_plan_limits
from app.schemas import UserOut
from app.database import get_db
from app.models import Bot, User
from sqlalchemy.orm import Session

router = APIRouter()
 
SUPPORTED_FILE_TYPES = {
    "pdf", "txt", "doc", "docx", "csv", "png", "jpg", "jpeg"
}

async def validate_word_count(text: str, current_user):
    plan_limits = get_plan_limits(current_user["subscription_plan_id"])
    word_count, _ = count_words_and_chars(text)
    
    if word_count > plan_limits["word_count_limit"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds {plan_limits['word_count_limit']} word limit for your {plan_limits['name']} plan"
        )
    return word_count

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
async def word_count_endpoint(
    files: List[UploadFile] = File(...),
    current_user: dict  = Depends(get_current_user)  
) -> List[Dict[str, Any]]:

    """
    Process files and return word/character counts with validation
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided"
        )
    
    # Get the user's plan limits first
    plan_limits = get_plan_limits(current_user["subscription_plan_id"])
    user_word_limit = plan_limits["word_count_limit"]
    total_words = 0 

    results = []
    
    for file in files:
        try:
            # Extract text
            text = await extract_text(file)
            word_count, char_count = count_words_and_chars(text)

            # Validate word count
            if word_count > user_word_limit:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File exceeds {user_word_limit} word limit for your {plan_limits['name']} plan"
                )

            results.append({
                "file_name": file.filename,
                "word_count": word_count,
                "character_count": char_count,
                "text_sample": text[:200] + "..." if len(text) > 200 else text,
                "plan_limit": user_word_limit,  
                "plan_name": plan_limits["name"]  
            })

        except HTTPException as he:
            results.append({
                "file_name": file.filename,
                "error": str(he.detail),
                "exceeds_limit": True,
                "plan_limit": user_word_limit,
                "plan_name": plan_limits["name"]
            })
        except Exception as e:
            results.append({
                "file_name": file.filename,
                "error": f"Processing error: {str(e)}",
                "plan_limit": user_word_limit,
                "plan_name": plan_limits["name"]
            })

    # Validate total words across all files
    if total_words > user_word_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Total words across all files ({total_words}) exceed your {plan_limits['name']} plan limit of {user_word_limit}"
        )

    return results


@router.get("/user/usage")
async def get_user_usage(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Get the user's total words used (sum of all their bots' word counts exclude delete bots)
        total_used = db.query(func.sum(Bot.word_count)).filter(
            Bot.user_id == current_user["user_id"],
            Bot.status != "Deleted",  
            Bot.is_active == True
        ).scalar() or 0

        # Also get from user table for verification
        user = db.query(User).filter(User.user_id == current_user["user_id"]).first()
        user_total = user.total_words_used if user else 0

        # If there's a discrepancy, update the user record
        if user and total_used != user_total:
            user.total_words_used = total_used
            db.commit()

        # Get plan limits
        plan_limits = get_plan_limits(current_user["subscription_plan_id"])
        
        return {
            "totalWordsUsed": total_used,
            "remainingWords": plan_limits["word_count_limit"] - total_used,
            "planLimit": plan_limits["word_count_limit"],
            "botWords": total_used,
            "userWords": user_total
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bot/update_word_count")
async def update_bot_word_count(
    bot_data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    #print(f"Received update request: {bot_data}")  
    #print(f"Current user: {current_user['user_id']}")  

    # Verify the bot belongs to the current user
    bot = db.query(Bot).filter(
        Bot.bot_id == bot_data["bot_id"],
        Bot.user_id == current_user["user_id"]
    ).first()
    
    if not bot:
        #print("Bot not found or doesn't belong to user")  
        raise HTTPException(status_code=404, detail="Bot not found")
        
    
    try:
        #print(f"Current bot word_count: {bot.word_count}")  
        # Calculate difference if this is an update
        word_count_diff = bot_data["word_count"] - (bot.word_count or 0)
        #print(f"Word count difference: {word_count_diff}")  
        
        # Update bot
        #print("calculation we will do",bot.word_count," added to ",bot_data["word_count"])
        bot.word_count = bot.word_count+bot_data["word_count"]
        #print("updated in db bot count=>",bot.word_count)
        
        # Update user's total
        user = db.query(User).filter(User.user_id == current_user["user_id"]).first()
        if user:
            #print(f"Current user total_words_used: {user.total_words_used}")  
            user.total_words_used = (user.total_words_used or 0) + bot_data["word_count"]
            #print(f"New user total_words_used: {user.total_words_used}")
        
        db.commit()
        print("Update successful!") 
        return {"success": True}
        
    except Exception as e:
        db.rollback()
        #print(f"Error during update: {str(e)}")  
        raise HTTPException(status_code=500, detail=str(e))