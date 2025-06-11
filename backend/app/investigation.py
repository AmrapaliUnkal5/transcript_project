from aiohttp import ClientError
from fastapi import APIRouter, Depends,  HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import SessionLocal, get_db
from app.models import Bot, ScrapedNode, YouTubeVideo
from app.models import File
from app.config import settings
from app.utils.file_size_validations_utils import get_hierarchical_file_path
import os
import boto3
from app.dependency import get_current_user


router = APIRouter(prefix="/investigation", tags=["Investigation"])

@router.get("/scraped-nodes/{bot_id}")
async def get_scraped_nodes(bot_id: int, db: Session = Depends(get_db)):
    """
    Get all scraped nodes for a bot with their nodes_text
    """
    try:
        nodes = db.query(ScrapedNode).filter(
            ScrapedNode.bot_id == bot_id,
            ScrapedNode.is_deleted == False
        ).order_by(ScrapedNode.created_at.desc()).all()
        
        if not nodes:
            return []
            
        return [
            {
                "id": node.id,
                "url": node.url,
                "title": node.title or "Untitled",
                "nodes_text": node.nodes_text,
                "nodes_text_count": node.nodes_text_count or 0,
                "created_at": node.created_at
            }
            for node in nodes
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/youtube-videos/{bot_id}")
async def get_youtube_videos(bot_id: int, db: Session = Depends(get_db)):
    """
    Get all YouTube videos for a bot with their transcripts
    """
    try:
        videos = db.query(YouTubeVideo).filter(
            YouTubeVideo.bot_id == bot_id,
            YouTubeVideo.is_deleted == False
        ).order_by(YouTubeVideo.created_at.desc()).all()
        
        if not videos:
            return []
            
        return [
            {
                "id": video.id,
                "video_id": video.video_id,
                "video_title": video.video_title or "Untitled Video",
                "video_url": video.video_url,
                "transcript": video.transcript,
                "transcript_count":video.transcript_count,
                "created_at": video.created_at
            }
            for video in videos
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
def get_file_content_from_local(file_path: str) -> str:
    """Read file content from local storage"""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading local file: {str(e)}")

def get_file_content_from_s3(file_path: str) -> str:
    """Read file content from S3 storage"""
    try:
        # Parse S3 path (format: s3://bucket-name/path/to/file)
        if not file_path.startswith('s3://'):
            raise ValueError("Invalid S3 path format")
        
        # Remove 's3://' prefix
        path_without_prefix = file_path[5:]
        
        # Split into bucket and key
        bucket_name, *key_parts = path_without_prefix.split('/')
        key = '/'.join(key_parts)
       
        s3 = boto3.client('s3')
        
        # Get object from S3
        print("Bucket:",bucket_name)
        print("Key:",key)
        response = s3.get_object(Bucket=bucket_name, Key=key)
        return response['Body'].read().decode('utf-8')
        
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"S3 Client Error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading S3 file: {str(e)}")

@router.get("/uploaded-files/{bot_id}")
async def get_uploaded_files_content(
    bot_id: int, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all uploaded files for a bot with their extracted text content.
    Handles both local storage and S3 storage scenarios.
    """
    try:
        # Verify the bot belongs to the current user
        bot = db.query(Bot).filter(
            Bot.bot_id == bot_id,
            Bot.user_id == current_user["user_id"]
        ).first()
        
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found or unauthorized access")
        
        # Get all files for this bot
        files = db.query(File).filter(
            File.bot_id == bot_id
        ).order_by(File.upload_date.desc()).all()
        
        if not files:
            return []
            
        results = []
        for file in files:
            try:
                # Determine if we're using S3 or local storage
                if settings.UPLOAD_DIR.startswith('s3://'):
                    content = get_file_content_from_s3(file.file_path)
                else:
                    # For local storage, verify the file exists
                    if not os.path.exists(file.file_path):
                        content = "File not found at expected location"
                    else:
                        content = get_file_content_from_local(file.file_path)
                        
                results.append({
                    "id": file.file_id,
                    "file_name": file.file_name,
                    "file_type": file.file_type,
                    "created_at": file.upload_date,
                    "word_count":file.word_count,
                    "content": content,
                    "storage_type": "S3" if settings.UPLOAD_DIR.startswith('s3://') else "Local"
                })
                
            except HTTPException as e:
                results.append({
                    "id": file.file_id,
                    "file_name": file.file_name,
                    "file_type": file.file_type,
                    "created_at": file.upload_date,
                    "word_count":file.word_count,
                    "content": f"Error reading file: {e.detail}",
                    "storage_type": "S3" if settings.UPLOAD_DIR.startswith('s3://') else "Local"
                })
            except Exception as e:
                results.append({
                    "id": file.file_id,
                    "file_name": file.file_name,
                    "file_type": file.file_type,
                    "created_at": file.upload_date,
                    "word_count":file.word_count,
                    "content": f"Unexpected error: {str(e)}",
                    "storage_type": "S3" if settings.UPLOAD_DIR.startswith('s3://') else "Local"
                })
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")