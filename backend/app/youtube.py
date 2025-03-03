import hashlib
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

def get_video_urls(channel_url):
    """Fetches all video URLs from a given YouTube channel."""
    ydl_opts = {
        "quiet": True,
        "extract_flat": True,
        "skip_download": True,
        "force_generic_extractor": True
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(channel_url, download=False)
    
    return [entry['url'] for entry in info.get('entries', []) if 'url' in entry]


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


def store_videos_in_chroma(bot_id: int, channel_url: str):
    """Extracts transcripts from all videos in a channel and stores them in the bot's ChromaDB collection."""

    video_urls = get_video_urls(channel_url)  # Fetch all video URLs

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
