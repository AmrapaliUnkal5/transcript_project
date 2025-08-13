from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException,WebSocket, WebSocketDisconnect
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import SessionLocal, get_db
from app import schemas
from app.models import Bot, File, ScrapedNode, User, YouTubeVideo
from typing import Dict, List
from fastapi.routing import APIRouter
import asyncio
import json
from app.websocket_manager import manager
from app.schemas import StartTrainingRequest
from app.utils.logger import get_module_logger
from app.utils.vectorization_utils import trigger_vectorization_if_needed
from app.botsettings import send_bot_activation_email

# Initialize logger
logger = get_module_logger(__name__)


router = APIRouter(prefix="/progress", tags=["Bot Progress Tracking"])

@router.get("/bot/{bot_id}")
def get_bot_progress_data(bot_id: int, db: Session = Depends(get_db)):
    """
    Get progress data for a bot by ID.
    Returns:
    - Files: file_name from files table
    - Scraped content: url and title from scraped_nodes table
    - YouTube videos: video_title and video_url from youtube_videos table
    """
    try:
        # Get files data
        files = db.query(File).filter(File.bot_id == bot_id).all()
        files_data = [{"file_name": file.file_name} for file in files]
        
        # Get scraped nodes data
        scraped_nodes = db.query(ScrapedNode).filter(ScrapedNode.bot_id == bot_id, ScrapedNode.is_deleted == False).all()
        scraped_data = [{
            "url": node.url,
            "title": node.title,
            "nodes_text_count": node.nodes_text_count or 0
        } for node in scraped_nodes]
        
        # Get YouTube videos data
        youtube_videos = db.query(YouTubeVideo).filter(YouTubeVideo.bot_id == bot_id,YouTubeVideo.is_deleted == False).all()
        youtube_data = [{
            "video_title": video.video_title,
            "video_url": video.video_url,
            "transcript_count": video.transcript_count or 0
        } for video in youtube_videos]
        
        return {
            "bot_id": bot_id,
            "files": files_data,
            "scraped_content": scraped_data,
            "youtube_videos": youtube_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching bot progress data: {str(e)}")

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Step 1: Wait for bot_id from client
        bot_id_msg = await websocket.receive_text()
        bot_id = int(bot_id_msg)  # assuming first message is bot_id

        while True:
            db = SessionLocal()  # create session manually if not using Depends
            status_data = await compute_status(bot_id, db)
            await websocket.send_text(json.dumps(status_data))
            # # --- Check if vectorization is needed ---
            any_extracted = (
                status_data["progress"]["files"].get("extracted", 0) > 0 or
                status_data["progress"]["youtube"].get("extracted", 0) > 0 or
                status_data["progress"]["websites"].get("extracted", 0) > 0
            )
            if any_extracted and status_data["overall_status"].lower() in ["training", "retraining"]:
                    logger.info(f"Triggering vectorization for bot {bot_id} via websocket polling")
                    await trigger_vectorization_if_needed(bot_id, db)
            
            db.close()
            await asyncio.sleep(3)

    except WebSocketDisconnect:
        manager.disconnect(websocket)

@router.websocket("/ws/user-bots-status")
async def user_bots_status_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        user_id_msg = await websocket.receive_text()
        user_id = int(user_id_msg)
        last_statuses = None
        while True:
            db = SessionLocal()
            data_status = await bot_status_compute(user_id, db)
            db.close()
            # Only send if status changed
            if last_statuses is None or data_status != last_statuses:
                await websocket.send_text(json.dumps(data_status))
                last_statuses = data_status
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        
async def bot_status_compute(user_id: int, db: Session):
    bots = db.query(Bot).filter(Bot.user_id == user_id, Bot.status != 'Deleted').all()
    status_list = []
    for bot in bots:
        if bot.status != "Draft":
            # Only compute status if not in Draft
            await compute_status(bot.bot_id, db)
        
        status_list.append({
            "bot_id": bot.bot_id,
            "status": bot.status,
        })
    return status_list


async def compute_status(bot_id: int, db: Session):
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    if bot.status == "Draft":
        return {
            "overall_status": "draft",
            "progress": {
                "files": {"status": "not_started", "completed": 0, "failed": 0, "pending": 0, "total": 0},
                "websites": {"status": "not_started", "completed": 0, "failed": 0, "pending": 0, "total": 0},
                "youtube": {"status": "not_started", "completed": 0, "failed": 0, "pending": 0, "total": 0}
            },
        }
    
    # If bot is manually set to Reconfiguring, keep that status
    if bot.status == "Reconfiguring":
        return {
            "overall_status": "reconfiguring",
            "progress": {
                "files": {"status": "paused", "completed": 0, "failed": 0, "pending": 0, "total": 0},
                "websites": {"status": "paused", "completed": 0, "failed": 0, "pending": 0, "total": 0},
                "youtube": {"status": "paused", "completed": 0, "failed": 0, "pending": 0, "total": 0}
            }
        }
     

    file_status = await get_file_status(bot_id, db)
    website_status = await get_website_status(bot_id, db)
    youtube_status = await get_youtube_status(bot_id, db)

    overall_status = determine_overall_status(file_status, website_status, youtube_status, bot)

    # update bot status
    bot.is_trained = (overall_status == "Active")
    bot.is_active = (overall_status == "Active")
    bot.status = overall_status
    bot.updated_at = datetime.utcnow()

    # Send activation email if bot just became active
    if overall_status == "Active" and not bot.active_mail_sent:
        user = db.query(User).filter(User.user_id == bot.user_id).first()
        if user:
            
            send_bot_activation_email(db=db, 
                                     user_name=user.name, 
                                     user_email=user.email, 
                                     bot_name=bot.bot_name, 
                                     bot_id=bot_id)
    db.commit()

    return {
        "overall_status": overall_status,
        "progress": {
            "files": file_status,
            "websites": website_status,
            "youtube": youtube_status
        },
        "is_trained": bot.is_trained
    }

@router.get("/checkstatus/{bot_id}")
async def get_bot_training_status(bot_id: int, db: Session = Depends(get_db)):
    try:
        status_data = await compute_status(bot_id, db)
        await notify_status_update(bot_id, db)  # ✅ Only broadcasts now
        return status_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def notify_status_update(bot_id: int, db: Session):
    try:
        status_data = await compute_status(bot_id, db)
        await manager.broadcast_json(status_data)
    except Exception as e:
        print(f"❌ Failed to notify clients: {e}")


async def get_file_status(bot_id: int, db: Session) -> Dict:
    """Get training status for files"""
    # Count files by status
    status_counts = db.query(
        File.status,
        func.count(File.file_id)  
    ).filter(  
        File.bot_id == bot_id, 
        
    ).group_by(
        File.status
    ).all()
    
    # Initialize counts
    counts = {
        "completed": 0,
        "failed": 0,
        "pending": 0,
        "total": 0,
        "extracting":0,
        "extracted":0,
    }
    
    # Populate counts
    for status, count in status_counts:
        if status == "Success":
            counts["completed"] = count
        elif status == "Failed":
            counts["failed"] = count
        else:  # pending or any other status
            counts["pending"] += count
            #Adding counts for extracting and extracted, no change done to count of pending            
            if status == "Extracting":
                counts["extracting"] += count  # ✅ lowercase key
            if status == "Extracted":
                counts["extracted"] += count  # ✅ lowercase key
        counts["total"] += count
        
    # Determine status for this knowledge type
    if counts["failed"] == counts["total"] and counts["total"] > 0:
        status = "error"
    elif counts["pending"] > 0:
        status = "training"
    else:
        status = "complete"
    
    return {
        **counts,
        "status": status
    }
    
async def get_website_status(bot_id: int, db: Session) -> Dict:
    """Get training status for scraped websites"""
    # Count websites by status
    status_counts = db.query(
        ScrapedNode.status,
        func.count(ScrapedNode.id)
        ).filter(
            ScrapedNode.bot_id == bot_id, 
            ScrapedNode.is_deleted == False
        ).group_by(
            ScrapedNode.status
        ).all()
    
    # Initialize counts
    counts = {
        "completed": 0,
        "failed": 0,
        "pending": 0,
        "total": 0,
        "extracting":0,
        "extracted":0,
    }
    
    # Populate counts
    for status, count in status_counts:
        if status == "Success":
            counts["completed"] = count
        elif status == "Failed":
            counts["failed"] = count
        else:  # pending or any other status
            counts["pending"] += count
             #Adding counts for extracting and extracted, no change done to count of pending            
            if status == "Extracting":
                counts["extracting"] += count  # ✅ lowercase key
            if status == "Extracted":
                counts["extracted"] += count  # ✅ lowercase key
        counts["total"] += count
    
    # Determine status for this knowledge type
    if counts["failed"] == counts["total"] and counts["total"] > 0:
        status = "error"
    elif counts["pending"] > 0:
        status = "training"
    else:
        status = "complete"
    
    return {
        **counts,
        "status": status
    }

async def get_youtube_status(bot_id: int, db: Session) -> Dict:
    """Get training status for YouTube videos"""
    # Count videos by status
    status_counts = db.query(
        YouTubeVideo.status,
        func.count(YouTubeVideo.id)
    ).filter(
        YouTubeVideo.bot_id == bot_id, 
        YouTubeVideo.is_deleted == False
    ).group_by(
        YouTubeVideo.status
    ).all()
    
    # Initialize counts
    counts = {
        "completed": 0,
        "failed": 0,
        "pending": 0,
        "total": 0,
        "extracting":0,
        "extracted":0,
    }
    
    # Populate counts
    for status, count in status_counts:
        if status == "Success":
            counts["completed"] = count
        elif status == "Failed":
            counts["failed"] = count
        else:  # pending or any other status
            counts["pending"] += count
             #Adding counts for extracting and extracted, no change done to count of pending            
            if status == "Extracting":
                counts["extracting"] += count  # ✅ lowercase key
            if status == "Extracted":
                counts["extracted"] += count  # ✅ lowercase key
        counts["total"] += count
    
    # Determine status for this knowledge type
    if counts["failed"] == counts["total"] and counts["total"] > 0:
        status = "error"
    elif counts["pending"] > 0:
        status = "training"
    else:
        status = "complete"
    
    return {
        **counts,
        "status": status
    }

def determine_overall_status(file_status: Dict, website_status: Dict, youtube_status: Dict, bot: Bot = None) -> str:
    """
    Determine overall bot status based on individual knowledge source statuses.
    
    Rules:
    - If ALL knowledge sources have failed (error status), return "error"
    - If ANY knowledge source is still training (training status), return "training"
    - Otherwise (all complete or mix of complete and some failed), return "active"
    """
    all_failed = (
        (file_status["status"] == "error") and
        (website_status["status"] == "error") and
        (youtube_status["status"] == "error")
    )
    
    if all_failed:
        return "Error"
    
    no_content=(
        (file_status["total"] == 0) and 
        (website_status["total"] == 0) and 
        (youtube_status["total"] == 0)
    )

    if no_content:
        return "Draft"
    
    # Check if any knowledge source is still training
    any_training = (
        file_status["status"] == "training" or
        website_status["status"] == "training" or
        youtube_status["status"] == "training"
    )
    
    if any_training:
        if bot.is_retrained:
            return "Retraining"
        return "Training"
    
    # Otherwise, bot is active (has at least one completed knowledge source)
    return "Active"