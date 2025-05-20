import hashlib
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
from app.models import ScrapedNode,WebsiteDB, Bot, User, UserSubscription,SubscriptionPlan  # Import the model
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from fastapi import Depends
from app.database import get_db
from urllib.parse import urlparse
from app.vector_db import add_document
from app.notifications import add_notification
from app.utils.logger import get_module_logger

# Function to detect if JavaScript is needed
def is_js_heavy(url):
    """
    Check if the website is JavaScript-heavy by looking for script tags.
    """
    try:
        print(f"[DEBUG] Checking if {url} is JS-heavy")
        response = requests.get(url, timeout=5)
        if "<script" in response.text.lower() or "react" in response.text.lower() or "angular" in response.text.lower():
            print(f"[DEBUG] {url} is JS-heavy")
            return True
    except Exception as e:
        print(f"[DEBUG] Error checking if {url} is JS-heavy: {str(e)}")
        return True
    print(f"[DEBUG] {url} is not JS-heavy")
    return False

# Static website scraping (BeautifulSoup)
def scrape_static_page(url):
  
    try:
        print(f"[DEBUG] Starting static scraping for {url}")
        
        response = requests.get(url, timeout=5)
        if response.status_code != 200:
            print(f"[DEBUG] Failed to fetch {url}: Status code {response.status_code}")
            return None

        soup = BeautifulSoup(response.text, "html.parser")
        title = soup.title.string if soup.title else "No title"
        text = " ".join([p.get_text() for p in soup.find_all("p")])
        
        print(f"[DEBUG] Static scraping results for {url}:")
        print(f"[DEBUG] - Title: {title}")
        print(f"[DEBUG] - Text length: {len(text)} characters")
        
        if not title:
            title = extract_page_title(text)  
        word_count = len(text.split())
        print(f"[DEBUG] - Word count: {word_count}")
        
        return {"url": url, "title": title,"text": text,"word_count":word_count}

    except Exception as e:
        print(f"[ERROR] Error scraping {url} with BeautifulSoup: {e}")
        import traceback
        print(f"[ERROR] Static scraping traceback: {traceback.format_exc()}")
        return None

# JavaScript-heavy website scraping (Playwright)
def scrape_dynamic_page(url):
    print(f"[DEBUG] Starting dynamic (Playwright) scraping for {url}")
   
    try:
        with sync_playwright() as p:
            print(f"[DEBUG] Playwright initialized for {url}")
            browser = p.chromium.launch(headless=True)
            print(f"[DEBUG] Browser launched for {url}")
            page = browser.new_page()
            print(f"[DEBUG] Navigating to {url}")
            page.goto(url, timeout=10000)
            print(f"[DEBUG] Waiting for page to load {url}")
            page.wait_for_load_state("networkidle")
            print(f"[DEBUG] Page loaded {url}")
            
            title = page.title()  # Extract the page title           
            text = page.inner_text("body")
            
            print(f"[DEBUG] Dynamic scraping results for {url}:")
            print(f"[DEBUG] - Title: {title}")
            print(f"[DEBUG] - Text length: {len(text)} characters")
            
            if not title:
                title = extract_page_title(text)            
            word_count = len(text.split())
            print(f"[DEBUG] - Word count: {word_count}")
            
            browser.close()
            return {"url": url, "title": title,"text": text,"word_count":word_count}
    except Exception as e:
        print(f"[ERROR] Error scraping {url} with Playwright: {e}")
        import traceback
        print(f"[ERROR] Playwright scraping traceback: {traceback.format_exc()}")
        return None

# Hybrid scraping function
def scrape_selected_nodes(url_list, bot_id, db: Session):
    logger = get_module_logger(__name__)
    
    logger.info(f"Starting scrape_selected_nodes", 
               extra={"bot_id": bot_id, "url_count": len(url_list), "urls": url_list})
    
    crawled_data = []
    failed_urls = []
        
    for url in url_list:
        logger.info(f"Processing URL", extra={"bot_id": bot_id, "url": url})
        result = None
        
        try:
            if is_js_heavy(url):
                logger.info(f"JavaScript detected - Using Playwright", extra={"bot_id": bot_id, "url": url})
                result = scrape_dynamic_page(url)
            else:
                logger.info(f"Static HTML detected - Using BeautifulSoup", extra={"bot_id": bot_id, "url": url})
                result = scrape_static_page(url)
                
            if result:
                logger.info(f"Successfully scraped URL", 
                          extra={"bot_id": bot_id, "url": url, "title": result.get("title", "No Title")})
                crawled_data.append(result)
                
                if result["text"]:
                    logger.info(f"Extracted text content", 
                              extra={"bot_id": bot_id, "url": url, 
                                   "word_count": result["word_count"], 
                                   "text_length": len(result["text"])})
                    
                    try:
                        update_word_counts(db, bot_id=bot_id, word_count=result["word_count"])
                        logger.debug(f"Updated word count", 
                                   extra={"bot_id": bot_id, "url": url, 
                                         "word_count": result["word_count"]})
                    except Exception as word_count_err:
                        logger.error(f"Failed to update word count", 
                                   extra={"bot_id": bot_id, "url": url, 
                                         "error": str(word_count_err)})
                    
                    try:
                        logger.info(f"Preparing to add document to vector DB", 
                                  extra={"bot_id": bot_id, "url": url})
                        
                        website_id = hashlib.md5(result["url"].encode()).hexdigest()
                        logger.debug(f"Generated document ID", 
                                   extra={"bot_id": bot_id, "url": url, 
                                         "document_id": website_id})
                        
                        # Create metadata for embedding - ENSURE CONSISTENT FORMAT
                        metadata = {
                            "id": website_id,               # Primary identifier 
                            "source": "website",            # Source type for filtering
                            "website_url": result["url"],   # Original source URL
                            "title": result.get("title", "No Title"),
                            "url": result["url"],
                            "file_name": result.get("title", "No Title"),  # Consistent with other document types
                            "bot_id": bot_id                # Always include bot_id
                        }
                        
                        logger.debug(f"Document metadata prepared", 
                                   extra={"bot_id": bot_id, "url": url, 
                                         "metadata": metadata})
                        
                        # Important: Pass user_id to add_document for proper embedding model selection
                        # Get the bot's user_id
                        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
                        user_id = bot.user_id if bot else None
                        
                        if user_id:
                            logger.info(f"Adding document to vector DB with user_id", 
                                      extra={"bot_id": bot_id, "url": url, 
                                            "user_id": user_id})
                            add_document(bot_id, text=result["text"], metadata=metadata, user_id=user_id)
                        else:
                            logger.warning(f"No user_id found for bot, adding document without user context", 
                                        extra={"bot_id": bot_id, "url": url})
                            add_document(bot_id, text=result["text"], metadata=metadata)
                        
                        logger.info(f"Successfully added document to vector DB", 
                                  extra={"bot_id": bot_id, "url": url, 
                                        "document_id": website_id})
                    except Exception as db_err:
                        logger.error(f"Failed to add document to vector DB", 
                                   extra={"bot_id": bot_id, "url": url, 
                                         "error": str(db_err)})
                        import traceback
                        logger.error(f"Vector DB error details", 
                                   extra={"bot_id": bot_id, "url": url, 
                                         "traceback": traceback.format_exc()})
                else:
                    logger.warning(f"No text content extracted", 
                                 extra={"bot_id": bot_id, "url": url})
            else:
                logger.warning(f"No content was scraped", extra={"bot_id": bot_id, "url": url})
                failed_urls.append(url)
        except Exception as e:
            logger.error(f"Unexpected error processing URL", 
                       extra={"bot_id": bot_id, "url": url, "error": str(e)})
            import traceback
            logger.error(f"Processing traceback", 
                       extra={"bot_id": bot_id, "url": url, 
                             "traceback": traceback.format_exc()})
            failed_urls.append(url)
    
    logger.info(f"Scraping completed", 
              extra={"bot_id": bot_id, "successful": len(crawled_data), 
                   "failed": len(failed_urls)})
    
    if crawled_data:
        try:
            save_scraped_nodes(crawled_data, bot_id, db)
            logger.info(f"Saved scraped nodes to database", 
                      extra={"bot_id": bot_id, "count": len(crawled_data)})
        except Exception as save_err:
            logger.error(f"Failed to save scraped nodes", 
                       extra={"bot_id": bot_id, "error": str(save_err)})
    else:
        logger.warning(f"No data was scraped from any URL", extra={"bot_id": bot_id})
        
        # Create completion notification even if no URLs were successfully scraped
        try:
            bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
            if bot:
                add_notification(
                    db=db,
                    event_type="WEB_SCRAPING_COMPLETED",
                    event_data=f"Web scraping completed but no content was found on the provided URLs.",
                    bot_id=bot_id,
                    user_id=bot.user_id
                )
                logger.info(f"Sent empty completion notification", extra={"bot_id": bot_id})
        except Exception as notify_err:
            logger.error(f"Failed to send empty completion notification", 
                       extra={"bot_id": bot_id, "error": str(notify_err)})

    return crawled_data


def get_website_nodes(base_url):
    """
    Extracts all unique internal links (nodes) from a given website.
    """
    try:
        response = requests.get(base_url, timeout=5)
        if response.status_code != 200:
            return {"error": "Failed to access website"}

        soup = BeautifulSoup(response.text, "html.parser")
        links = set()

        for link in soup.find_all("a", href=True):
            full_url = urljoin(base_url, link["href"])
            if full_url.startswith(base_url):
                links.add(full_url)

        return {"nodes": list(links)}

    except Exception as e:
        return {"error": str(e)}
    
def save_scraped_nodes(url_list, bot_id, db: Session):
    """Save scraped URLs and titles to the database with the associated bot_id."""
    print("save_scraped_nodes")

    if bot_id is None:
        print(" Error: bot_id cannot be None!")
        return  # Stop execution if bot_id is None

    try:
        if url_list:  # Only proceed if there are URLs
            # Extract domain from first URL
            first_url = url_list[0]["url"]
            domain = urlparse(first_url).netloc
            
            # Check if website exists or create it
            website = db.query(WebsiteDB).filter(
                WebsiteDB.domain == domain,
                WebsiteDB.bot_id == bot_id
            ).first()
            
            if not website:
                website = WebsiteDB(domain=domain, bot_id=bot_id)
                db.add(website)
                db.flush()

        for item in url_list:
            url = item["url"]
            title = item.get("title", "No Title")  # Default to "No Title" if missing
            word_count = item["word_count"]
            text_content = item.get("text", "")  # Get the text content
            print("title",title)
            print("url",url)
            print("word_count",word_count)

            # Check if URL already exists for the given bot_id
            existing_node = db.query(ScrapedNode).filter(
                ScrapedNode.url == url,
                ScrapedNode.bot_id == bot_id,
                ScrapedNode.is_deleted == False  # ✅ Ensure uniqueness per bot_id
            ).first()
            print(existing_node)

            if existing_node:
                # Update title if it's missing or outdated
                if not existing_node.title or existing_node.title != title:
                    existing_node.title = title
                
                # Update nodes_text field with text content
                existing_node.nodes_text = text_content
                existing_node.embedding_status = "pending"
                existing_node.last_embedded = None
                print("Website node updated with text content")
            else:
                print("New")
                # Insert new record with text content
                new_node = ScrapedNode(
                    url=url, 
                    title=title, 
                    bot_id=bot_id,
                    website_id=website.id,
                    nodes_text_count=word_count if website else None,
                    nodes_text=text_content,
                    embedding_status="pending"
                )
                db.add(new_node)
                event_type = "SCRAPED_URL_SAVED"
                event_data = f"URL '{url}' for bot added successfully. {word_count} words extracted."
                add_notification(
                    
                    db=db,
                    event_type=event_type,
                    event_data=event_data,
                    bot_id=bot_id,
                    user_id=None

                    )

        db.commit()  # Commit changes to the database
        print("✅ Scraped nodes with titles saved successfully!")

    except Exception as e:
        db.rollback()  # Rollback in case of an error
        print(f"❌ Error saving nodes: {e}")
    finally:
        db.close()  # Close the session

def get_scraped_urls_func(bot_id, db: Session):
    scraped_nodes = db.query(ScrapedNode.url, ScrapedNode.title, ScrapedNode.nodes_text_count).filter(
        ScrapedNode.bot_id == bot_id,
        ScrapedNode.is_deleted == False
    ).all()
    print("Scrapped Node=>",scraped_nodes)
    return [{"url": node[0], "title": node[1], "Word_Counts": node[2]} for node in scraped_nodes]  # Extract URL & Title

def extract_page_title(html_content):
    """Extracts the title from HTML content."""
    soup = BeautifulSoup(html_content, "html.parser")
    title_tag = soup.find("title")
    return title_tag.text.strip() if title_tag else "No Title"


def update_word_counts(db: Session, bot_id: int, word_count: int):
   
    # Update bot word count
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if bot:
        bot.word_count = (bot.word_count or 0) + word_count

    # Update user's total words used
    user = db.query(User).filter(User.user_id == bot.user_id).first()
    user_subscription = db.query(UserSubscription).filter(UserSubscription.user_id == user.user_id,UserSubscription.status.notin_(["pending", "failed", "cancelled"])).order_by(UserSubscription.payment_date.desc()).first()
    subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else 1
    
    subscription_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription_plan_id).first()
    word_count_limit = subscription_plan.word_count_limit if subscription_plan else 0
    if user:
        total_words_used = (user.total_words_used or 0) + word_count
        if(total_words_used > word_count_limit ):
            return {"message": "Word Count Exceeded", "data": []}
        else:
            user.total_words_used = total_words_used
            db.commit()

def send_web_scraping_failure_notification(db: Session, bot_id: int, reason: str):
    """
    Sends a notification when web scraping fails.
    
    Args:
        db: Database session
        bot_id: Bot ID
        reason: Reason for failure
    """
    try:
        # Get bot information
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        if not bot:
            print(f"Warning: Bot with ID {bot_id} not found when sending failure notification")
            return
            
        # Create notification
        add_notification(
            db=db,
            event_type="WEB_SCRAPING_FAILED",
            event_data=f"Web scraping failed. Reason: {reason}",
            bot_id=bot_id,
            user_id=bot.user_id
        )
        
        print(f"✅ Web scraping failure notification sent for bot {bot_id}")
    except Exception as e:
        print(f"❌ Error sending web scraping failure notification: {str(e)}")