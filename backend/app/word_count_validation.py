import re
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
from app.fetchsubscripitonplans import get_subscription_plan_by_id
from app.schemas import UserOut
from app.database import get_db
from app.models import Bot, User
from sqlalchemy.orm import Session
from app.utils.file_size_validations_utils import get_current_usage

router = APIRouter()
 
SUPPORTED_FILE_TYPES = {
    "pdf", "txt", "doc", "docx", "csv", "png", "jpg", "jpeg"
}

async def validate_word_count(text: str, current_user, db: Session):
    plan = await get_subscription_plan_by_id(current_user["subscription_plan_id"], db)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription plan not found"
        )
    
    word_count, _ = count_words_and_chars(text)
    print("effective_word_limit=>",plan["effective_word_limit"])

    if word_count > plan["effective_word_limit"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds {plan['word_count_limit']} word limit for your {plan['name']} plan"
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
    """Extract text from DOCX paragraphs using multiple methods"""
    try:
        docx_data = await docx.read()
        
        # Method 1: Try docx2txt first (more reliable)
        try:
            import docx2txt
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp_file:
                temp_file.write(docx_data)
                temp_path = temp_file.name
            
            text = docx2txt.process(temp_path)
            return text.strip()
        except Exception:
            # Method 2: Fallback to python-docx
            doc = Document(io.BytesIO(docx_data))
            return " ".join([para.text for para in doc.paragraphs])
        finally:
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.unlink(temp_path)
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

## DOC Processing ##
async def extract_text_from_doc(doc: UploadFile) -> str:
    """Extract text from DOC files using docx2txt"""
    temp_path = None
    try:
        doc_data = await doc.read()
        
        # Method 1: Try docx2txt first
        try:
            import docx2txt
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".doc") as temp_file:
                temp_file.write(doc_data)
                temp_path = temp_file.name
            
            text = docx2txt.process(temp_path)
            if text and text.strip():
                return text.strip()
            
            # If docx2txt returns empty content, fall through to validation
            
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="DOC file processing not available. Please contact support."
            )
        except Exception as docx2txt_err:
            # Log the error but continue to validation step
            pass
        
        # Method 2: If docx2txt failed or returned empty, validate if it's a proper DOC file
        try:
            import olefile
            if olefile.isOleFile(io.BytesIO(doc_data)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This DOC file format is not fully supported. Please convert to DOCX format for better compatibility."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid DOC file format."
                )
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="DOC file processing failed. Please convert to DOCX format."
            )
        except HTTPException:
            raise  # Re-raise our HTTP exceptions
        except Exception:
            # If validation also fails, raise a general error
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="DOC file could not be processed. Please convert to DOCX format."
            )
            
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"DOC file processing error: {str(e)}"
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass

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
        # return text + " " + await extract_text_from_pdf_images(file)
        return text
    elif file_ext == "docx":
        text = await extract_text_from_docx(file)
        await file.seek(0)
        # return text + " " + await extract_text_from_docx_images(file)
        return text
    elif file_ext == "txt":
        return await extract_text_from_txt(file)
    elif file_ext == "csv":
        return await extract_text_from_csv(file)
    elif file_ext in ("png", "jpg", "jpeg"):
        return await extract_text_from_image_file(file)
    elif file_ext == "doc":
        return await extract_text_from_doc(file)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.filename}"
        )

@router.post("/word_count/", response_model=List[Dict[str, Any]])
async def word_count_endpoint(
    files: List[UploadFile] = File(...),
    current_user: dict  = Depends(get_current_user),
    db: Session = Depends(get_db)
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
    plan_limits = await get_subscription_plan_by_id(current_user["subscription_plan_id"], db)
    if not plan_limits:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
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
            #Bot.is_active == True
        ).scalar() or 0

        # Also get from user table for verification
        user = db.query(User).filter(User.user_id == current_user["user_id"]).first()
        user_total = user.total_words_used if user else 0

        # If there's a discrepancy, update the user record
        if user and total_used != user_total:
            user.total_words_used = total_used
            db.commit()

        # Get the user's total storage used (sum of all their bots' word counts exclude delete bots)
        total_storage = db.query(func.sum(Bot.file_size)).filter(
            Bot.user_id == current_user["user_id"],
            Bot.status != "Deleted",  
            #Bot.is_active == True
        ).scalar() or 0

        # Also get from user table for verification
        user_file_size = db.query(User).filter(User.user_id == current_user["user_id"]).first()
        user_file_size_total = user_file_size.total_file_size if user else 0

        # If there's a discrepancy, update the user record
        if user_file_size and total_storage != user_file_size_total:
            user_file_size.total_file_size = total_storage
            db.commit()


        # Get plan limits
        plan = await get_subscription_plan_by_id(current_user["subscription_plan_id"], db,current_user["user_id"])
        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found")
        
        
        return {
            "totalWordsUsed": total_used,
            "remainingWords": plan["word_count_limit"] - total_used,
            "planLimit":plan.get("effective_word_limit"),
            "botWords": total_used,
            "userWords": user_total,
            "totalStorageUsed": total_storage,
            "storageLimit": parse_storage_limit(plan["storage_limit"]),
            "storageLimitDisplay": plan["storage_limit"],
            "wordBoost": plan.get("addon_additional_words", 0),
            "messageBoost": plan.get("addon_additional_messages", 0),
            
            # Effective limits (plan + addons)
            "effectiveWordLimit": plan.get("effective_word_limit", plan["word_count_limit"]),
            "remainingWords": plan.get("effective_word_limit", plan["word_count_limit"]) - total_used,
            
            # Addon details
            "activeAddons": plan.get("active_addons", []),

        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
def parse_storage_limit(limit_str: str) -> int:
    units = {"KB": 1024, "MB": 1024**2, "GB": 1024**3, "TB": 1024**4}
    match = re.match(r"^(\d+)\s*(KB|MB|GB|TB)$", limit_str.upper())
    if not match:
        return 20 * 1024**2  # Default 20MB if parsing fails
    return int(match.group(1)) * units[match.group(2)]

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
        print("Bot not found or doesn't belong to user")  
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

        # Update file size if provided
        #print(f"Current bot file_size: {bot.file_size}") 
        if "file_size" in bot_data:
            file_size_diff = bot_data["file_size"] - (bot.file_size or 0)
            #print("calculation we will do",bot.file_size," added to ",bot_data["file_size"])
            bot.file_size = bot.file_size + bot_data["file_size"]
        
        # Update user's total
        user = db.query(User).filter(User.user_id == current_user["user_id"]).first()
        if user:
            #print(f"Current user total_words_used: {user.total_words_used}")  
            user.total_words_used = (user.total_words_used or 0) + bot_data["word_count"]
        if "file_size" in bot_data:
            #print(f"Current user total_file_size: {user.total_file_size}")  
            user.total_file_size = (user.total_file_size or 0) + bot_data["file_size"]
            #print(f"New user total_words_used: {user.total_words_used}")
            #print(f"New user total_file_size: {user.total_file_size}")
        
        db.commit()
        print("Update successful!") 
        return {"success": True}
        
    except Exception as e:
        db.rollback()
        #print(f"Error during update: {str(e)}")  
        raise HTTPException(status_code=500, detail=str(e))
    
async def validate_cumulative_word_count(
    new_word_count: int, 
    current_user: dict, 
    db: Session
):
    """Validate that adding new words won't exceed plan limit"""
    plan_limits = await get_subscription_plan_by_id(current_user["subscription_plan_id"], db)
    if not plan_limits:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription plan not found"
        )
    
    # Get current usage
    current_usage = await get_current_usage(current_user["user_id"], db)
    
    # Validate cumulative word count
    if current_usage["word_count"] + new_word_count > plan_limits["word_count_limit"]:
        raise HTTPException(
            status_code=400,
            detail=f"Upload would exceed your word count limit of {plan_limits['word_count_limit']}"
        )