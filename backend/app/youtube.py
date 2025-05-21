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
from app.notifications import add_notification
from dotenv import load_dotenv
import traceback
from apify_client import ApifyClient
from app.utils.upload_knowledge_utils import chunk_text

# Load environment variables
load_dotenv()

# Get cookie path from environment variable or use default
COOKIE_PATH = os.getenv("YOUTUBE_COOKIE_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "cookies", "youtube_cookies.json"))
# Get Apify API token from environment variable
APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN", "")

def get_yt_dlp_options(base_opts=None):
    if base_opts is None:
        base_opts = {}

    # Default options to help avoid bot detection
    base_opts.update({
        "quiet": True,
        "no_warnings": False,  # Show warnings for debugging
        "skip_download": True,
        "nocheckcertificate": True,
        "ignoreerrors": False,
        "logtostderr": False,
        "geo_bypass": True,
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    })

    # Try to use cookies file if it exists
    if os.path.exists(COOKIE_PATH):
        print(f"✅ Using YouTube cookies from: {COOKIE_PATH}")
        base_opts["cookies"] = COOKIE_PATH
    
    return base_opts

# Regex to allow only YouTube video and playlist URLs
YOUTUBE_REGEX = re.compile(
    r"^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|playlist\?list=)|youtu\.be\/).+"
)

def get_video_urls(channel_url):
    """Fetches video URL(s) from a given YouTube video or playlist."""
    is_single_video = "watch?v=" in channel_url or "youtu.be/" in channel_url
    is_playlist = "list=" in channel_url
    
    print("is_single_video", is_single_video)
    print("is_playlist", is_playlist)
    
    # Check if it's a valid video or playlist URL
    if not YOUTUBE_REGEX.match(channel_url):
        raise HTTPException(
            status_code=400, 
            detail="Invalid YouTube URL. Please provide a valid video or playlist URL."
        )
    
    # For single videos, don't use yt-dlp at all - just return the URL directly
    if is_single_video and not is_playlist:
        print(f"✅ Processing single video URL: {channel_url}")
        # Just return the original URL for single videos
        return [channel_url]
    
    # Only use yt-dlp for playlists
    ydl_opts = get_yt_dlp_options({
        "quiet": True,
        "skip_download": True,
        "force_generic_extractor": True,
        "extract_flat": True  # Always use extract_flat for playlists
    })

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"🔍 Fetching playlist videos from: {channel_url}")
            info = ydl.extract_info(channel_url, download=False)
            # Handle playlist
            video_urls = [entry['url'] for entry in info.get('entries', []) if 'url' in entry]
            print(f"✅ Found {len(video_urls)} videos in playlist")
            return video_urls
    
    except yt_dlp.utils.DownloadError as e:
        error_str = str(e)
        print(f"⚠️ YouTube download error: {error_str}")
        
        if "Sign in to confirm you're not a bot" in error_str:
            raise HTTPException(
                status_code=400,
                detail="YouTube bot protection triggered. Please try with a direct video URL instead of a playlist."
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Could not process the YouTube playlist. Please try using individual video URLs instead."
            )
    except Exception as e:
        print(f"❌ Error processing YouTube URL: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Error processing the YouTube URL. Please ensure it's a valid video or playlist URL."
        )

def get_transcript_with_apify(video_url):
    """Fetches transcript from a YouTube video using Apify."""
    print(f"🔍 Starting Apify transcript retrieval for URL: {video_url}")
    try:
        # Extract video ID from URL (handle all formats)
        video_id = None
        
        if "youtu.be/" in video_url:
            # Format: https://youtu.be/VIDEO_ID
            video_id = video_url.split("youtu.be/")[-1].split("?")[0].split("#")[0]
            print(f"📌 Extracted video ID from youtu.be URL: {video_id}")
        elif "youtube.com/watch" in video_url and "v=" in video_url:
            # Format: https://www.youtube.com/watch?v=VIDEO_ID
            video_id = video_url.split("v=")[-1].split("&")[0].split("#")[0]
            print(f"📌 Extracted video ID from youtube.com/watch URL: {video_id}")
        elif "youtube.com/embed/" in video_url:
            # Format: https://www.youtube.com/embed/VIDEO_ID
            video_id = video_url.split("embed/")[-1].split("?")[0].split("#")[0]
            print(f"📌 Extracted video ID from embed URL: {video_id}")
        elif "youtube.com/v/" in video_url:
            # Format: https://www.youtube.com/v/VIDEO_ID
            video_id = video_url.split("v/")[-1].split("?")[0].split("#")[0]
            print(f"📌 Extracted video ID from youtube.com/v URL: {video_id}")
        else:
            print(f"⚠️ Could not extract video ID from URL format: {video_url}")
            return None, None
        
        # Video ID sanity check
        if not video_id or len(video_id) < 8:
            print(f"⚠️ Invalid video ID extracted: {video_id}")
            return None, None
        
        # Initialize the ApifyClient with API token
        if not APIFY_API_TOKEN:
            print("⚠️ Apify API token not set in environment variables. Please add APIFY_API_TOKEN to your .env file")
            return None, None
        else:
            print(f"✅ Using Apify API token: {APIFY_API_TOKEN[:4]}...{APIFY_API_TOKEN[-4:] if len(APIFY_API_TOKEN) > 8 else ''}")
        
        print(f"🔄 Initializing Apify client")
        client = ApifyClient(APIFY_API_TOKEN)
        
        # Prepare the Actor input with the YouTube video URL
        run_input = {
            "youtubeUrl": [
                {"url": video_url}
            ]
        }
        print(f"📋 Prepared Apify actor input: {run_input}")
        
        # Run the Actor and wait for it to finish
        print(f"🚀 Starting Apify actor 'dz_omar/youtube-transcript-extractor'")
        run = client.actor("dz_omar/youtube-transcript-extractor").call(run_input=run_input)
        print(f"✅ Apify actor run completed with ID: {run.get('id')}")
        print(f"📊 Dataset ID: {run.get('defaultDatasetId')}")
        
        # Fetch the transcript from the dataset
        print(f"🔄 Fetching transcript data from Apify dataset")
        transcript_text = ""
        video_metadata = {}
        items_found = 0
        
        print(f"🔄 Iterating through dataset items")
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            items_found += 1
            print(f"📄 Processing dataset item #{items_found}")
            print(f"📄 Item video ID: {item.get('videoId')}, Expected: {video_id}")
            
            # Debug the actual response structure
            print(f"📊 Item keys: {list(item.keys())}")
            
            # Check for transcriptText (the actual field in the response)
            if "transcriptText" in item:
                print(f"✅ Found transcriptText field in item #{items_found}")
                transcript_text = item.get("transcriptText", "")
                print(f"📊 Transcript length: {len(transcript_text)} characters")
            elif "hasTranscript" in item:
                print(f"📊 hasTranscript field value: {item.get('hasTranscript')}")
            else:
                print(f"⚠️ No transcript field in item #{items_found}")
            
            # Match by video ID and check if we have transcript text
            if item.get("videoId") == video_id and "transcriptText" in item:
                transcript_text = item.get("transcriptText", "")
                # Save all metadata from Apify
                video_metadata = {
                    "video_id": item.get("videoId", ""),
                    "video_title": item.get("Video_title", "Untitled Video"),
                    "video_url": item.get("VideoURL", video_url),
                    "channel_id": item.get("channel", {}).get("id"),
                    "channel_name": item.get("channel", {}).get("name", "Unknown Channel"),
                    "upload_date": item.get("published_Date"),
                    "views": item.get("Views", "0"),
                    "likes": item.get("likes", "0"),
                    "description": item.get("Description", ""),
                    "thumbnail_url": item.get("thumbnail", ""),
                    "duration": None,  # Not provided by Apify but kept for consistency
                    "is_playlist": False,
                    "playlist_id": None,
                    "playlist_name": None
                }
                print(f"✅ Extracted transcript text and metadata for video {video_id}")
                print(f"📊 Metadata keys: {list(video_metadata.keys())}")
                break
        
        if not transcript_text:
            print(f"⚠️ No matching transcript found for video {video_id} in {items_found} dataset items")
            return None, None
        
        print(f"🎉 Successfully retrieved transcript with {len(transcript_text.split())} words")
        return transcript_text, video_metadata
    except Exception as e:
        print(f"❌ Error getting transcript with Apify for {video_url}")
        print(f"❌ Exception type: {type(e).__name__}")
        print(f"❌ Exception message: {str(e)}")
        print(f"❌ Exception details:", traceback.format_exc())
        return None, None

def get_video_transcript(video_url):
    """Fetches transcript from a YouTube video."""
    print("⭐ Starting get_video_transcript for URL:", video_url)
    
    # First try using Apify (works on AWS)
    print("🔄 Attempting to get transcript using Apify")
    transcript, metadata = get_transcript_with_apify(video_url)
    if transcript:
        print(f"✅ Successfully retrieved transcript using Apify ({len(transcript.split())} words)")
        return transcript, metadata
    
    # Fallback to YouTube Transcript API if Apify fails
    print("🔄 Apify failed, falling back to YouTube Transcript API")
    try:
        video_id = video_url.split("v=")[-1]
        if "youtu.be/" in video_url:
            video_id = video_url.split("youtu.be/")[-1].split("?")[0]
        
        print(f"🔍 Extracting transcript for video ID: {video_id} using YouTube Transcript API")
        transcript_data = YouTubeTranscriptApi.get_transcript(video_id)
        transcript = " ".join([entry["text"] for entry in transcript_data])
        print(f"✅ Successfully retrieved transcript using YouTube Transcript API ({len(transcript.split())} words)")
        
        # YouTube Transcript API doesn't provide metadata, return None for metadata
        return transcript, None
    except Exception as e:
        print(f"❌ Could not fetch transcript for {video_url} using either method")
        print(f"❌ YouTube API error: {type(e).__name__} - {str(e)}")
        return None, None
    

from app.vector_db import add_document

def send_failure_notification(db: Session, bot_id: int, video_url: str, reason: str):
    """Sends a notification when a YouTube video fails to process."""
    message = f"Failed to process YouTube video '{video_url}'. Reason: {reason}"
    add_notification(
        db=db,
        event_type="YOUTUBE_VIDEO_FAILED",
        event_data=message,
        bot_id=bot_id,
        user_id=None
    )

def store_videos_in_chroma(bot_id: int, video_urls: list[str], db: Session):
    stored_videos = []
    failed_videos = []
    for video_url in video_urls:
        try:
            # Get transcript and metadata
            transcript, video_metadata = get_video_transcript(video_url)
            
            if not transcript:
                reason = f"Could not fetch transcript for {video_url}"
                print(reason)
                failed_videos.append({"video_url": video_url, "reason": reason})
                send_failure_notification(db, bot_id, video_url, reason)
                continue
                
            print(f"🎥 Processing transcript with {len(transcript.split())} words from {video_url}")

            # If we don't have metadata from Apify, extract video ID from URL
            if not video_metadata:
                if "youtu.be/" in video_url:
                    extracted_video_id = video_url.split("youtu.be/")[-1].split("?")[0]
                elif "v=" in video_url:
                    extracted_video_id = video_url.split("v=")[-1].split("&")[0]
                else:
                    extracted_video_id = hashlib.md5(video_url.encode()).hexdigest()
            else:
                extracted_video_id = video_metadata.get("video_id")
            
            # Check for existing video
            existing_video = db.query(YouTubeVideo).filter(
                YouTubeVideo.video_id == extracted_video_id,
                YouTubeVideo.bot_id == bot_id,
                YouTubeVideo.is_deleted == False
            ).first()

            if existing_video:
                # Update existing video with transcript content
                existing_video.transcript = transcript
                existing_video.embedding_status = "pending"
                existing_video.last_embedded = None
                existing_video.transcript_count = len(transcript.split())
                db.commit()
                
                # Add notification for updated video
                event_type = "YOUTUBE_VIDEO_UPDATED"
                event_data = f"YouTube video '{existing_video.video_title}' updated with transcript. {existing_video.transcript_count} words extracted."
                send_success_notification(db, bot_id, event_type, event_data, existing_video.video_title)
                
                # Add to stored videos
                stored_videos.append({
                    "video_id": existing_video.video_id,
                    "video_title": existing_video.video_title,
                    "transcript_count": existing_video.transcript_count
                })
                
                # Split transcript into chunks before storing in ChromaDB
                transcript_chunks = chunk_text(transcript)
                print(f"📄 Split transcript into {len(transcript_chunks)} chunks")
                
                # Store each chunk with proper metadata
                for i, chunk in enumerate(transcript_chunks):
                    chunk_metadata = {
                        "id": f"youtube-{existing_video.id}-chunk-{i+1}",
                        "source": "youtube",
                        "source_id": existing_video.video_id,
                        "title": existing_video.video_title,
                        "url": existing_video.video_url,
                        "channel_name": existing_video.channel_name,
                        "chunk_number": i + 1,
                        "total_chunks": len(transcript_chunks),
                        "bot_id": bot_id
                    }
                    # Store the chunk in ChromaDB
                    add_document(bot_id, text=chunk, metadata=chunk_metadata)
                
                continue

            # Enforce word limit
            word_count_transcript = len(transcript.split())
            limit_status = update_word_count_for_bot(transcript, bot_id, db)
            if limit_status["status"] == "error":
                reason = limit_status["message"]
                print(reason)
                failed_videos.append({"video_url": video_url, "reason": reason})
                send_failure_notification(db, bot_id, video_url, reason)
                continue

            # Process metadata and create video record
            if video_metadata:
                # Process metadata and create video_data as before
                print(f"✅ Using metadata from Apify for video: {video_metadata.get('video_title')}")
                
                # Parse upload date if available
                upload_date = None
                if video_metadata.get("upload_date"):
                    try:
                        # Attempt to parse various date formats
                        date_str = video_metadata.get("upload_date", "")
                        if "," in date_str:  # Format like "May 31, 2024"
                            upload_date = datetime.strptime(date_str, "%b %d, %Y")
                        else:
                            # Handle other date formats as needed
                            print(f"⚠️ Unrecognized date format: {date_str}")
                    except Exception as e:
                        print(f"⚠️ Error parsing date: {e}")
                
                # Parse view count
                view_count = 0
                try:
                    views_str = str(video_metadata.get("views", "0"))
                    # Remove commas, 'views' text, and get first part
                    views_str = views_str.replace(",", "").split()[0]
                    view_count = int(views_str)
                except (ValueError, IndexError) as e:
                    print(f"⚠️ Error parsing view count: {e}")
                    
                # Parse likes
                likes = 0
                try:
                    likes_str = str(video_metadata.get("likes", "0"))
                    # Handle "K" suffix
                    if "K" in likes_str:
                        likes_str = likes_str.replace("K", "").replace(",", "")
                        likes = int(float(likes_str) * 1000)
                    elif "M" in likes_str:
                        likes_str = likes_str.replace("M", "").replace(",", "")
                        likes = int(float(likes_str) * 1000000)
                    else:
                        likes_str = likes_str.replace(",", "")
                        likes = int(likes_str)
                except (ValueError, IndexError) as e:
                    print(f"⚠️ Error parsing likes: {e}")
                
                video_data = {
                    "video_id": video_metadata.get("video_id", extracted_video_id),
                    "video_title": video_metadata.get("video_title", "Untitled Video"),
                    "video_url": video_metadata.get("video_url", video_url),
                    "channel_id": video_metadata.get("channel_id"),
                    "channel_name": video_metadata.get("channel_name", "Unknown Channel"),
                    "duration": video_metadata.get("duration", 0),
                    "upload_date": upload_date,
                    "is_playlist": video_metadata.get("is_playlist", False),
                    "playlist_id": video_metadata.get("playlist_id"),
                    "playlist_name": video_metadata.get("playlist_name"),
                    "view_count": view_count,
                    "likes": likes,
                    "description": video_metadata.get("description", ""),
                    "thumbnail_url": video_metadata.get("thumbnail_url"),
                    "bot_id": bot_id,
                    "transcript_count": word_count_transcript,
                    "transcript": transcript,
                    "embedding_status": "pending"
                }
            else:
                # Create minimal video data when metadata isn't available
                print(f"⚠️ No metadata available from Apify, creating minimal record")
                video_data = {
                    "video_id": extracted_video_id,
                    "video_title": "YouTube Video",
                    "video_url": video_url,
                    "channel_id": None,
                    "channel_name": "Unknown Channel",
                    "duration": 0,
                    "upload_date": None,
                    "is_playlist": False,
                    "playlist_id": None,
                    "playlist_name": None,
                    "view_count": 0,
                    "likes": 0,
                    "description": None,
                    "thumbnail_url": None,
                    "bot_id": bot_id,
                    "transcript_count": word_count_transcript,
                    "transcript": transcript,
                    "embedding_status": "pending"
                }

            print(f"📝 Saving video data to database: {video_data['video_title']}")
            new_video = YouTubeVideo(**video_data)
            db.add(new_video)
            db.commit()
            stored_videos.append(video_data)

            # Add notification for successful video processing
            event_type = "YOUTUBE_VIDEO_PROCESSED"
            event_data = f"YouTube video '{video_data['video_title']}' processed successfully. {word_count_transcript} words extracted."
            send_success_notification(db, bot_id, event_type, event_data, video_data["video_title"])

            # After saving the video record, chunk and store the transcript
            transcript_chunks = chunk_text(transcript)
            print(f"📄 Split transcript into {len(transcript_chunks)} chunks")
            
            # Store each chunk with proper metadata
            for i, chunk in enumerate(transcript_chunks):
                chunk_metadata = {
                    "id": f"youtube-{new_video.id}-chunk-{i+1}",
                    "source": "youtube",
                    "source_id": new_video.video_id,
                    "title": new_video.video_title,
                    "url": new_video.video_url,
                    "channel_name": new_video.channel_name,
                    "chunk_number": i + 1,
                    "total_chunks": len(transcript_chunks),
                    "bot_id": bot_id
                }
                # Store the chunk in ChromaDB
                add_document(bot_id, text=chunk, metadata=chunk_metadata)

        except Exception as e:
            traceback_str = traceback.format_exc()
            print(f"⚠️ Error processing {video_url}: {e}")
            print(traceback_str)
            failed_videos.append({"video_url": video_url, "reason": str(e)})
            send_failure_notification(db, bot_id, video_url, str(e))

    # Send consolidated report
    report_result = report_video_processing_results(db, bot_id, stored_videos, failed_videos)

    return {
        "stored_videos": stored_videos,
        "failed_videos": failed_videos,
        "report": report_result
    }

def update_word_count_for_bot(transcript: str, bot_id: int, db: Session) -> dict:
    """Checks word count against the user's subscription limit and updates the total word count."""
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    user = db.query(User).filter(User.user_id == bot.user_id).first() if bot else None
    
    if not user:
        return {"status": "error", "message": "User not found."}
    
    user_subscription = db.query(UserSubscription).filter(UserSubscription.user_id == user.user_id,UserSubscription.status.notin_(["pending", "failed", "cancelled"])).order_by(UserSubscription.payment_date.desc()).first()
    subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else 1
    
    subscription_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription_plan_id).first()
    word_count_limit = subscription_plan.word_count_limit if subscription_plan else 0
    print("word_count_limit",word_count_limit)
    
    word_count = len(transcript.split())  # Calculate words in the transcript
    print("user.total_words_used before adding from DB",user.total_words_used)
    
    new_total_words = (user.total_words_used or 0) + word_count
    print("user.total_words_used after adding from DB",new_total_words)
    new_total_words_of_bot = ( bot.word_count or 0) + word_count
    print("new_total_words",new_total_words)
    
    
    if new_total_words > word_count_limit:
        return {"status": "error", "message": f"⚠️ Word count limit exceeded! You have used {user.total_words_used} words out of {word_count_limit}."}
    
    user.total_words_used = new_total_words
    bot.word_count = new_total_words_of_bot
    db.commit()
    return {"status": "success", "message": "✅ Word count updated successfully."}

# Async version for background processing
async def process_videos_in_background(bot_id: int, video_urls: list[str], db: Session):
    """
    Background task to process YouTube videos and send notification when complete.
    This function is meant to be run as a background task.
    """
    print(f"🎬 Starting background processing of {len(video_urls)} YouTube videos for bot {bot_id}")
    
    try:
        result = store_videos_in_chroma(bot_id, video_urls, db)
        
        # Prepare notification data
        success_count = len(result.get("stored_videos", []))
        failed_count = len(result.get("failed_videos", []))
        
        # Create notification for success
        event_type = "YOUTUBE_PROCESSING_COMPLETE"
        
        if success_count > 0 and failed_count == 0:
            event_data = f"✅ All {success_count} YouTube videos were processed successfully!"
        elif success_count > 0 and failed_count > 0:
            event_data = f"⚠️ {success_count} videos processed successfully, but {failed_count} videos failed."
        else:
            event_data = f"❌ All {failed_count} videos failed to process."
        
        # Get bot to find user_id
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        user_id = bot.user_id if bot else None
        
        # Add the completion notification
        add_notification(
            db=db,
            event_type=event_type,
            event_data=event_data,
            bot_id=bot_id,
            user_id=user_id
        )
        
        print(f"🏁 Finished background processing of YouTube videos for bot {bot_id}: {success_count} success, {failed_count} failed")
    
    except Exception as e:
        print(f"❌ Error in background processing of YouTube videos: {str(e)}")
        # Send error notification
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        user_id = bot.user_id if bot else None
        
        add_notification(
            db=db,
            event_type="YOUTUBE_PROCESSING_ERROR",
            event_data=f"❌ Error processing YouTube videos: {str(e)}",
            bot_id=bot_id,
            user_id=user_id
        )

def send_success_notification(db, bot_id, event_type, event_data, video_title):
    """Send a notification about successful video processing"""
    try:
        add_notification(
            db=db,
            event_type=event_type,
            event_data=event_data,
            bot_id=bot_id,
            user_id=None
        )
        print(f"✅ Processed video: {video_title}")
    except Exception as e:
        print(f"❌ Error sending success notification: {e}")

def report_video_processing_results(db, bot_id, stored_videos, failed_videos):
    """Send a consolidated report about video processing results"""
    try:
        # Get the bot's user ID for notification
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        
        if not bot:
            print(f"❌ Could not find bot with ID {bot_id} for sending report")
            return False
            
        # Create report summary
        total_videos = len(stored_videos) + len(failed_videos)
        success_count = len(stored_videos)
        failed_count = len(failed_videos)
        
        # Only send report if we processed any videos
        if total_videos > 0:
            event_type = "YOUTUBE_PROCESSING_REPORT"
            event_data = (
                f"YouTube video processing completed. "
                f"Successfully processed {success_count} of {total_videos} videos. "
                f"Failed: {failed_count}."
            )
            
            add_notification(
                db=db,
                event_type=event_type,
                event_data=event_data,
                bot_id=bot_id,
                user_id=bot.user_id
            )
            
            print(f"📊 Processing report sent for bot {bot_id}")
            return True
        
        return False
    except Exception as e:
        print(f"❌ Error sending processing report: {e}")
        return False