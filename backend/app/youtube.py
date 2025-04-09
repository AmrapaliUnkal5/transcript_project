import hashlib
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi
from fastapi import APIRouter, Depends, HTTPException
import re
from app.models import YouTubeVideo, User, Bot,UserSubscription,SubscriptionPlan  # Import the model
from app.database import get_db  # Ensure this is imported
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import os
from app.dependency import get_current_user

COOKIE_PATH = "~/chatbot/Chatbot/cookies/youtube_cookies.json"

def get_yt_dlp_options(base_opts=None):
    if base_opts is None:
        base_opts = {}

    if os.path.exists(COOKIE_PATH):
        base_opts["cookies"] = COOKIE_PATH
    return base_opts

# Regex to allow only YouTube video and playlist URLs
YOUTUBE_REGEX = re.compile(
    r"^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|playlist\?list=)|youtu\.be\/).+"
)

def get_video_urls(channel_url):
    """Fetches all video URLs from a given YouTube channel."""
    is_single_video = "watch?v=" in channel_url or "youtu.be/" in channel_url # Check if it's a single video URL
   
    is_playlist = "list=" in channel_url  # Check if it's a playlist URL
    print("is_single_video",is_single_video)
    # Check if it's a valid video or playlist URL
    # Validate YouTube URL (only allow videos & playlists)
    if not YOUTUBE_REGEX.match(channel_url):
        raise HTTPException(
            status_code=400, 
            detail="Invalid YouTube URL. Please provide a valid video or playlist URL."
        )
    ydl_opts = get_yt_dlp_options({
        "quiet": True,
        "skip_download": True,
        "force_generic_extractor": True
    })
    # If it's a single video, remove extract_flat (needed for full metadata)
    if is_single_video and not is_playlist:
        ydl_opts["extract_flat"] = False
    else:
        ydl_opts["extract_flat"] = True

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:

            info = ydl.extract_info(channel_url, download=False)
            if is_single_video:
                return [info.get("webpage_url")]
            
            return [entry['url'] for entry in info.get('entries', []) if 'url' in entry]
            
        
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail="The provided URL is not a valid YouTube video or playlist. Please ensure the URL points to a YouTube video or playlist.",
            )


def get_video_transcript(video_url):
    """Fetches transcript from a YouTube video."""
    print("get_video_transcript")
    video_id = video_url.split("v=")[-1]
    
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return " ".join([entry["text"] for entry in transcript])
    except Exception as e:
        print(f"⚠️ Could not fetch transcript for {video_url}: {e}")
        return None
    

from app.vector_db import add_document


def store_videos_in_chroma(bot_id: int, video_urls: list[str],db: Session):
    """Extracts transcripts from all videos in a channel and stores them in the bot's ChromaDB collection."""
    stored_videos = []
    failed_videos = []

    #video_urls = get_video_urls(channel_url)  # Fetch all video URLs
    #print("store_videos_in_chroma")

    for video_url in video_urls:
        transcript = get_video_transcript(video_url)  # Get transcript text
        
        if transcript:
            video_id = hashlib.md5(video_url.encode()).hexdigest()  # ✅ Generate unique ID from URL
            metadata = {
                "id": video_id,   # ✅ Ensure unique ID is included
                "source": "YouTube",
                "video_url": video_url
            }
            print("test")
            

            add_document(bot_id, text=transcript, metadata=metadata)  # ✅ Same as PDF & text storage
            print("options")


            # ✅ Extract metadata after ChromaDB storage
            ydl_opts = get_yt_dlp_options({"quiet": True})
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                try:
                    info = ydl.extract_info(video_url, download=False)

                    # ✅ Check if video already exists in DB
                    existing_video = (
                        db.query(YouTubeVideo)
                        .filter(YouTubeVideo.video_id == info.get("id"), YouTubeVideo.bot_id == bot_id,YouTubeVideo.is_deleted == False)
                        .first()
                    )
                    if existing_video:
                        print(f"⚠️ Video {info.get('id')} already exists. Skipping insertion.")
                        failed_videos.append({"video_url": video_url, "reason": f"⚠️ Video {info.get('id')} already exists. Skipping insertion."})
                        continue  

                    limit_status = update_word_count_for_bot(transcript, bot_id, db)
                    word_count_transcript = len(transcript.split())  # Calculate words in the transcript
                    if limit_status["status"] == "error":
                        print(limit_status["message"])
                        failed_videos.append({"video_url": video_url, "reason": limit_status["message"]})
                        continue  # Skip this video if word limit exceeded

                    # ✅ Prepare video metadata for DB
                    video_data = {
                        "video_id": info.get("id"),
                        "video_title": info.get("title", "Unknown Title"),
                        "video_url": video_url,
                        "channel_id": info.get("channel_id", None),
                        "channel_name": info.get("channel", "Unknown Channel"),
                        "duration": info.get("duration", 0),
                        "upload_date": datetime.strptime(info.get("upload_date", "19700101"), "%Y%m%d"),
                        "is_playlist": "playlist" in info.get("_type", ""),
                        "playlist_id": info.get("playlist_id", None),
                        "playlist_name": info.get("playlist_title", None),
                        "view_count": info.get("view_count", 0),
                        "likes": info.get("like_count", 0),
                        "description": info.get("description", None),
                        "thumbnail_url": info.get("thumbnail", None),
                        "bot_id": bot_id,
                        "transcript_count": word_count_transcript, 
                        "created_at": datetime.now(timezone.utc),
                    }
                    print("video_data",video_data)

                    # ✅ Store video metadata in PostgreSQL
                    db_video = YouTubeVideo(**video_data)
                    db.add(db_video)
                    db.commit()
                    stored_videos.append(video_data)
                    print(f"✅ Successfully stored video: {video_data['video_title']}")
                    

                except Exception as e:
                    print(f"⚠️ Metadata extraction failed for {video_url}: {e}")
                    failed_videos.append({"video_url": video_url, "reason": str(e)})
                    continue  
        else :
            print(f"⚠️ Transcript could not be retrieved for {video_url}. Skipping storage.")
            failed_videos.append({"video_url": video_url, "reason": "Transcript retrieval failed"})


    return {"message": "All YouTube transcripts stored successfully!",
            "stored_videos":stored_videos,
            "failed_videos":failed_videos}




def update_word_count_for_bot(transcript: str, bot_id: int, db: Session) -> dict:
    """Checks word count against the user's subscription limit and updates the total word count."""
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    user = db.query(User).filter(User.user_id == bot.user_id).first() if bot else None
    
    if not user:
        return {"status": "error", "message": "User not found."}
    
    user_subscription = db.query(UserSubscription).filter(UserSubscription.user_id == user.user_id).first()
    subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else 1
    
    subscription_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription_plan_id).first()
    word_count_limit = subscription_plan.word_count_limit if subscription_plan else 0
    print("word_count_limit",word_count_limit)
    
    word_count = len(transcript.split())  # Calculate words in the transcript
    
    new_total_words = (user.total_words_used or 0) + word_count
    new_total_words_of_bot = ( bot.word_count or 0) + word_count
    print("new_total_words",new_total_words)
    
    
    if new_total_words > word_count_limit:
        return {"status": "error", "message": f"⚠️ Word count limit exceeded! You have used {user.total_words_used} words out of {word_count_limit}."}
    
    user.total_words_used = new_total_words
    bot.word_count = new_total_words_of_bot
    db.commit()
    return {"status": "success", "message": "✅ Word count updated successfully."}