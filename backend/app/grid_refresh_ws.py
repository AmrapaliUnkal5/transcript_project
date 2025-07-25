from fastapi import WebSocket, APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Bot, File, ScrapedNode, YouTubeVideo

import asyncio

router = APIRouter()

@router.websocket("/ws/grid-refresh")
async def grid_refresh_ws(websocket: WebSocket, bot_id: int, db: Session = Depends(get_db)):
    await websocket.accept()

    try:
        while True:
            files_status = get_files_status(db, bot_id)
            youtube_status = get_youtube_status(db, bot_id)
            website_status = get_scraped_node_status(db, bot_id)
            print("file_status")

            await websocket.send_json({
                "type": "GridStatus",
                "files": files_status,
                "youtube": youtube_status,
                "websites": website_status
            })

            await asyncio.sleep(5)  # Refresh interval
    except Exception as e:
        print(f"WebSocket grid refresh closed: {e}")
    finally:
        await websocket.close()


def get_files_status(db: Session, bot_id: int):
    return {
        "extracting": db.query(File).filter_by(bot_id=bot_id, status="Extracting").count(),
        "extracted": db.query(File).filter_by(bot_id=bot_id, status="Extracted").count(),
        "embedding": db.query(File).filter_by(bot_id=bot_id, status="Embedding").count(),
        "success": db.query(File).filter_by(bot_id=bot_id, status="Success").count(),
        "failed": db.query(File).filter_by(bot_id=bot_id, status="Failed").count(),
    }

def get_youtube_status(db: Session, bot_id: int):
    return {
        "extracting": db.query(YouTubeVideo).filter_by(bot_id=bot_id, status="Extracting").count(),
        "extracted": db.query(YouTubeVideo).filter_by(bot_id=bot_id, status="Extracted").count(),
        "embedding": db.query(YouTubeVideo).filter_by(bot_id=bot_id, status="Embedding").count(),
        "success": db.query(YouTubeVideo).filter_by(bot_id=bot_id, status="Success").count(),
        "failed": db.query(YouTubeVideo).filter_by(bot_id=bot_id, status="Failed").count(),
    }

def get_scraped_node_status(db: Session, bot_id: int):
    return {
        "extracting": db.query(ScrapedNode).filter_by(bot_id=bot_id, status="Extracting").count(),
        "extracted": db.query(ScrapedNode).filter_by(bot_id=bot_id, status="Extracted").count(),
        "embedding": db.query(ScrapedNode).filter_by(bot_id=bot_id, status="Embedding").count(),
        "success": db.query(ScrapedNode).filter_by(bot_id=bot_id, status="Success").count(),
        "failed": db.query(ScrapedNode).filter_by(bot_id=bot_id, status="Failed").count(),
    }
