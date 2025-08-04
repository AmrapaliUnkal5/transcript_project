from sqlalchemy.orm import Session
from app.utils.logger import get_module_logger
# Create a logger for this module
logger = get_module_logger(__name__)

# in vectorization_utils.py
async def trigger_vectorization_if_needed(bot_id: int, db: Session):
    from app.models import File, YouTubeVideo, ScrapedNode
    from app.celery_tasks import process_file_upload_part2, process_youtube_videos_part2, process_web_scraping_part2

    triggered = False
    logger.info(f"🧠 Triggering vectorization check for bot_id={bot_id}")

    # --- Files ---
    files = db.query(File).filter(File.bot_id == bot_id, File.status == "Extracted").all()
    for file in files:
        file.status = "Embedding"
        db.add(file)
        process_file_upload_part2.delay(bot_id, file.unique_file_name)
        triggered = True

    # --- YouTube ---
    videos = db.query(YouTubeVideo).filter(
        YouTubeVideo.bot_id == bot_id,
        YouTubeVideo.status == "Extracted",
        YouTubeVideo.transcript.isnot(None),
        YouTubeVideo.is_deleted == False
    ).all()
    if videos:
        for v in videos:
            v.status = "Embedding"
            db.add(v)
        process_youtube_videos_part2.delay(bot_id, [v.id for v in videos])
        triggered = True

    # --- Scraped Nodes ---
    nodes = db.query(ScrapedNode).filter(
        ScrapedNode.bot_id == bot_id,
        ScrapedNode.status == "Extracted",
        ScrapedNode.nodes_text.isnot(None),
        ScrapedNode.is_deleted == False
    ).all()
    if nodes:
        for n in nodes:
            n.status = "Embedding"
            db.add(n)
        process_web_scraping_part2.delay(bot_id, [n.id for n in nodes])
        triggered = True

    db.commit()
    return triggered
