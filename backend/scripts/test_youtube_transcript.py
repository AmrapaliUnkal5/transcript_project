#!/usr/bin/env python3
"""
Script to test YouTube transcript retrieval and diagnose issues.
Run this script on your dev server to test transcript retrieval with specific videos.
"""

import logging
from pathlib import Path
import os
import sys
import re
from urllib.parse import urlparse, parse_qs
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound, _errors

# Configure logger
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def get_yt_dlp_options():
    base_opts = {
        "quiet": True,
        "skip_download": True,
        # Add more options to bypass bot detection
        "nocheckcertificate": True,
        "ignoreerrors": True,
        "no_warnings": True,
        # User-Agent to mimic browser
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    
    # Look for cookies in standard locations
    cookie_paths = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cookies", "youtube_cookies.json"),
        os.path.expanduser("~/chatbot/Chatbot/backend/cookies/youtube_cookies.json"),
        os.getenv("YOUTUBE_COOKIE_PATH")
    ]
    
    # Use the first cookie file found
    for path in cookie_paths:
        if path and os.path.exists(path):
            logger.info(f"Using cookie file: {path}")
            base_opts["cookies"] = path
            break
    else:
        logger.warning("Warning: No cookie file found. Authentication may fail.")
    
    return base_opts

def check_video_accessibility(video_url):
    """Check if a video is accessible using yt-dlp"""
    logger.info(f"\n===== Checking video accessibility for {video_url} =====")
    
    try:
        with yt_dlp.YoutubeDL(get_yt_dlp_options()) as ydl:
            info = ydl.extract_info(video_url, download=False)
            logger.info(f"✅ Video accessible: {info.get('title')}")
            logger.info(f"Duration: {info.get('duration')} seconds")
            logger.info(f"Upload date: {info.get('upload_date')}")
            logger.info(f"Channel: {info.get('uploader')}")
            return True
    except Exception as e:
        logger.error(f"❌ Video access failed: {str(e)}")
        
        # Fallback mechanism for authentication issues
        if "Sign in to confirm you're not a bot" in str(e):
            logger.info("\n🔄 Trying fallback method (direct transcript API without authentication)...")
            # Extract video ID
            if "youtu.be/" in video_url:
                video_id = video_url.split("youtu.be/")[-1].split("?")[0]
            elif "v=" in video_url:
                video_id = video_url.split("v=")[-1].split("&")[0]
            else:
                logger.error("❌ Could not extract video ID from URL")
                return False
                
            # Try direct transcript API
            try:
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
                logger.info("✅ Fallback successful! Video is accessible via transcript API")
                return True
            except Exception as transcript_error:
                logger.error(f"❌ Fallback method also failed: {str(transcript_error)}")
        
        return False

def test_get_transcript(video_url):
    """Test retrieving transcript from a YouTube video"""
    logger.info(f"\n===== Testing transcript retrieval for {video_url} =====")
    
    # Extract video ID
    if "youtu.be/" in video_url:
        video_id = video_url.split("youtu.be/")[-1].split("?")[0]
    elif "v=" in video_url:
        video_id = video_url.split("v=")[-1].split("&")[0]
    else:
        logger.error(f"❌ Could not extract video ID from URL: {video_url}")
        return None
        
    logger.info(f"Video ID: {video_id}")
    
    # Try listing available transcripts
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        languages = [tr.language_code for tr in transcript_list]
        logger.info(f"Available transcript languages: {languages}")
        
        # Try English first if available
        if 'en' in languages:
            try:
                logger.info("Trying to get English transcript...")
                transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
                logger.info(f"✅ Successfully retrieved English transcript with {len(transcript)} segments")
                
                # Print a sample
                if transcript:
                    logger.info("\nSample transcript text:")
                    sample = " ".join([entry["text"] for entry in transcript[:5]])
                    logger.info(f"{sample}...\n")
                return True
            except Exception as e:
                logger.error(f"❌ Failed to get English transcript: {str(e)}")
        
        # Try getting any transcript
        for language in languages:
            try:
                logger.info(f"Trying language: {language}")
                transcript = transcript_list.find_transcript([language]).fetch()
                logger.info(f"✅ Successfully retrieved {language} transcript with {len(transcript)} segments")
                
                # Print a sample
                if transcript:
                    logger.info("\nSample transcript text:")
                    sample = " ".join([entry["text"] for entry in transcript[:5]])
                    logger.info(f"{sample}...\n")
                return True
            except Exception as e:
                logger.error(f"❌ Failed to get {language} transcript: {str(e)}")
                
        return False
        
    except TranscriptsDisabled:
        logger.error("❌ Transcripts are disabled for this video")
        return False
    except NoTranscriptFound:
        logger.error("❌ No transcript found for this video")
        return False
    except Exception as e:
        logger.error(f"❌ Error listing transcripts: {str(e)}")
        
        # Try direct retrieval as fallback
        try:
            logger.info("Trying direct transcript retrieval...")
            transcript = YouTubeTranscriptApi.get_transcript(video_id)
            logger.info(f"✅ Successfully retrieved transcript with {len(transcript)} segments")
            return True
        except Exception as direct_error:
            logger.error(f"❌ Direct retrieval failed: {str(direct_error)}")
            return False

def main():
    if len(sys.argv) < 2:
        logger.info("Usage: python test_youtube_transcript.py <youtube_url1> [youtube_url2] ...")
        logger.info("Example: python test_youtube_transcript.py https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        logger.info("\nAlternative videos to try:")
        logger.info("- TED Talk: https://www.youtube.com/watch?v=8jPQjjsBbIc")
        logger.info("- Khan Academy: https://www.youtube.com/watch?v=EW5PcUzx_kA")
        logger.info("- MIT OpenCourseWare: https://www.youtube.com/watch?v=HtSuA80QTyo")
        sys.exit(1)
    
    video_urls = sys.argv[1:]
    
    for url in video_urls:
        logger.info("\n" + "=" * 60)
        logger.info(f"TESTING URL: {url}")
        logger.info("=" * 60)
        
        # Check if video is accessible first
        if check_video_accessibility(url):
            # Then test transcript retrieval
            test_get_transcript(url)
        
        logger.info("\n" + "=" * 60)

if __name__ == "__main__":
    main() 