import hashlib
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi
from fastapi import APIRouter, Depends, HTTPException
import re

def get_video_urls(channel_url):
    """Fetches all video URLs from a given YouTube channel."""
    is_single_video = "watch?v=" in channel_url  # Check if it's a single video URL
   
    is_playlist = "list=" in channel_url  # Check if it's a playlist URL
    print("is_single_video",is_single_video)
    # Check if it's a valid video or playlist URL
    if not re.match(r"https://www\.youtube\.com/(watch\?v=|playlist\?list=)", channel_url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL. Please provide a direct video or playlist URL.")

    ydl_opts = {
        "quiet": True,
        #"extract_flat": True,
        "skip_download": True,
        "force_generic_extractor": True
    }
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
    video_id = video_url.split("v=")[-1]
    
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return " ".join([entry["text"] for entry in transcript])
    except Exception as e:
        print(f"⚠️ Could not fetch transcript for {video_url}: {e}")
        return None
    

from app.vector_db import add_document


def store_videos_in_chroma(bot_id: int, video_urls: list[str]):
    """Extracts transcripts from all videos in a channel and stores them in the bot's ChromaDB collection."""

    #video_urls = get_video_urls(channel_url)  # Fetch all video URLs

    for video_url in video_urls:
        transcript = get_video_transcript(video_url)  # Get transcript text
        
        if transcript:
            video_id = hashlib.md5(video_url.encode()).hexdigest()  # ✅ Generate unique ID from URL
            metadata = {
                "id": video_id,   # ✅ Ensure unique ID is included
                "source": "YouTube",
                "video_url": video_url
            }
            add_document(bot_id, text=transcript, metadata=metadata)  # ✅ Same as PDF & text storage

    return {"message": "All YouTube transcripts stored successfully!"}
