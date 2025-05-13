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
from apify_client import ApifyClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Apify API token from environment variable
APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN", "")

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

def test_apify_transcript(video_url):
    """Test retrieving transcript from a YouTube video using Apify"""
    logger.info(f"\n===== Testing Apify transcript retrieval for {video_url} =====")
    
    # Extract video ID from URL
    if "youtu.be/" in video_url:
        video_id = video_url.split("youtu.be/")[-1].split("?")[0]
    elif "v=" in video_url:
        video_id = video_url.split("v=")[-1].split("&")[0]
    else:
        logger.error(f"❌ Could not extract video ID from URL: {video_url}")
        return None
    
    logger.info(f"Video ID: {video_id}")
    
    # Check if Apify token is available
    if not APIFY_API_TOKEN:
        logger.error("❌ Apify API token not set in environment variables")
        return None
    
    try:
        # Initialize the ApifyClient with API token
        client = ApifyClient(APIFY_API_TOKEN)
        
        # Prepare the Actor input with the YouTube video URL
        run_input = {
            "youtubeUrl": [
                {"url": video_url}
            ]
        }
        
        logger.info("Starting Apify actor to extract transcript...")
        
        # Run the Actor and wait for it to finish
        run = client.actor("dz_omar/youtube-transcript-extractor").call(run_input=run_input)
        
        logger.info(f"Apify run completed. Dataset ID: {run['defaultDatasetId']}")
        
        # Fetch the transcript from the dataset
        transcript_found = False
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            if item.get("videoId") == video_id and "transcript" in item:
                transcript_segments = item.get("transcript", [])
                transcript_text = " ".join([segment.get("text", "") for segment in transcript_segments])
                
                logger.info(f"✅ Successfully retrieved transcript using Apify with {len(transcript_segments)} segments")
                
                # Print a sample
                sample_segments = transcript_segments[:5]
                sample_text = " ".join([segment.get("text", "") for segment in sample_segments])
                logger.info("\nSample transcript text:")
                logger.info(f"{sample_text}...\n")
                
                transcript_found = True
                break
        
        if not transcript_found:
            logger.error("❌ No transcript found in Apify response")
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error using Apify to retrieve transcript: {str(e)}")
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
            # Test both transcript methods
            logger.info("\n" + "-" * 40)
            logger.info("TESTING YOUTUBE TRANSCRIPT API")
            logger.info("-" * 40)
            yt_api_result = test_get_transcript(url)
            
            logger.info("\n" + "-" * 40)
            logger.info("TESTING APIFY TRANSCRIPT EXTRACTION")
            logger.info("-" * 40)
            apify_result = test_apify_transcript(url)
            
            if yt_api_result and apify_result:
                logger.info("\n✅ BOTH METHODS SUCCEEDED")
            elif yt_api_result:
                logger.info("\n⚠️ ONLY YOUTUBE TRANSCRIPT API SUCCEEDED")
            elif apify_result:
                logger.info("\n⚠️ ONLY APIFY METHOD SUCCEEDED")
            else:
                logger.info("\n❌ BOTH METHODS FAILED")
        
        logger.info("\n" + "=" * 60)

if __name__ == "__main__":
    main() 