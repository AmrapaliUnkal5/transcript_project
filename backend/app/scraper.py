import hashlib
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
from markdownify import markdownify as md
from app.models import ScrapedNode,WebsiteDB, Bot, User, UserSubscription,SubscriptionPlan  # Import the model
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from fastapi import Depends
from app.database import get_db
from urllib.parse import urlparse
from app.vector_db import add_document
from app.notifications import add_notification
from app.utils.logger import get_module_logger
from app.utils.upload_knowledge_utils import chunk_text
from urllib.parse import urlparse, urlunparse, urljoin, urldefrag, parse_qsl, urlencode
import time
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor
from app.word_count_validation import validate_cumulative_word_count_sync_for_celery

NON_HTML_EXTENSIONS = (
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg",
    ".webp", ".ico", ".tiff", ".tif", ".mp4", ".mp3", ".zip", ".rar", ".exe",
    ".css", ".js", ".woff", ".woff2", ".ttf", ".eot", ".otf", ".avi", ".mov"
)

def clean_html_for_content(soup):
    """
    Clean HTML by removing navigation, footer, images, and other non-content elements.
    Also removes hidden/invisible elements that shouldn't be indexed.

    Args:
        soup: BeautifulSoup object

    Returns:
        Cleaned BeautifulSoup object
    """
    print("[DEBUG] Starting HTML cleaning...")

    # 1. Remove navigation elements
    nav_selectors = [
        'nav', 'header', '[role="navigation"]',
        '.nav', '.navigation', '.navbar', '.menu',
        '.header', '.top-bar', '.site-header',
        '#navigation', '#nav', '#menu', '#header'
    ]

    for selector in nav_selectors:
        for element in soup.select(selector):
            print(f"[DEBUG] Removing navigation element: {selector}")
            element.decompose()

    # 2. Remove footer elements
    footer_selectors = [
        'footer', '[role="contentinfo"]',
        '.footer', '.site-footer', '.page-footer',
        '#footer', '#site-footer'
    ]

    for selector in footer_selectors:
        for element in soup.select(selector):
            print(f"[DEBUG] Removing footer element: {selector}")
            element.decompose()

    # 3. Remove all images
    for img in soup.find_all('img'):
        img.decompose()
    print(f"[DEBUG] Removed all images")

    # 4. Remove hidden elements (CSS visibility)
    # Elements with display: none, visibility: hidden, or hidden attribute
    hidden_elements = soup.find_all(style=lambda value: value and ('display:none' in value.replace(' ', '') or 'display: none' in value))
    for element in hidden_elements:
        print(f"[DEBUG] Removing hidden element (display:none): {element.name}")
        element.decompose()

    # Remove elements with hidden attribute
    for element in soup.find_all(attrs={'hidden': True}):
        print(f"[DEBUG] Removing element with hidden attribute")
        element.decompose()

    # Remove elements with aria-hidden="true" (screen reader hidden)
    for element in soup.find_all(attrs={'aria-hidden': 'true'}):
        print(f"[DEBUG] Removing aria-hidden element")
        element.decompose()

    # 5. Remove other common non-content elements
    other_selectors = [
        'aside', '.sidebar', '.widget',
        '.social-links', '.social-media',
        '.cookie-notice', '.popup', '.modal',
        '.advertisement', '.ad', '.ads',
        'template',  # HTML5 template tags (never visible)
        'noscript',  # NoScript fallback content
    ]

    for selector in other_selectors:
        for element in soup.select(selector):
            print(f"[DEBUG] Removing non-content element: {selector}")
            element.decompose()

    print("[DEBUG] HTML cleaning completed")
    return soup


# Function to detect if JavaScript is needed
def is_js_heavy(url):
    """
    Check if the website is JavaScript-heavy by looking for script tags and modern JS frameworks.
    """
    try:
        print(f"[DEBUG] Checking if {url} is JS-heavy")
        response = requests.get(url, timeout=5, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        html_content = response.text.lower()
        
        # Check for script tags
        if "<script" in html_content:
            print(f"[DEBUG] {url} has script tags - JS-heavy")
            return True
        
        # Check for modern JavaScript frameworks and libraries
        js_indicators = [
            'react', 'angular', 'vue.js', 'vue', 'ember', 'backbone',
            'knockout', 'meteor', 'polymer', 'aurelia', 'svelte',
            'lit-element', 'stencil', 'alpine.js', 'alpine',
            'lwc', 'lightning', 'salesforce',  # Salesforce Lightning Web Components
            'webpack', 'browserify', 'rollup', 'parcel',
            'next.js', 'nuxt', 'gatsby', 'sveltekit',
            'require.js', 'systemjs', 'esm.sh',
            'data-react', 'data-vue', 'ng-app', 'ng-controller',
            '__next', '__nuxt', '_app', 'chunk-', 'vendor.',
            'spa-', 'single-page', 'client-side',
            'xhr', 'fetch(', 'websocket', 'socket.io',
            'json-ld', 'application/ld+json',
        ]
        
        for indicator in js_indicators:
            if indicator in html_content:
                print(f"[DEBUG] {url} contains '{indicator}' - JS-heavy")
                return True
        
        # Check for minimal HTML content (likely dynamic)
        # Remove script and style content for analysis
        import re
        clean_html = re.sub(r'<script.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
        clean_html = re.sub(r'<style.*?</style>', '', clean_html, flags=re.DOTALL | re.IGNORECASE)
        
        # Extract text content
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(clean_html, "html.parser")
        text_content = soup.get_text(strip=True)
        
        # If very little text content, likely JS-heavy
        if len(text_content) < 200:
            print(f"[DEBUG] {url} has minimal text content ({len(text_content)} chars) - likely JS-heavy")
            return True
            
    except Exception as e:
        print(f"[DEBUG] Error checking if {url} is JS-heavy: {str(e)}")
        # If we can't determine, assume JS-heavy for safety
        return True
    
    print(f"[DEBUG] {url} is not JS-heavy")
    return False

# Static website scraping (BeautifulSoup)
def scrape_static_page(url):
  
    try:
        print(f"[DEBUG] Starting static scraping for {url}")
        
        # Add better headers to avoid blocking
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        
        response = requests.get(url, timeout=10, headers=headers)
        if response.status_code != 200:
            print(f"[DEBUG] Failed to fetch {url}: Status code {response.status_code}")
            return None

        soup = BeautifulSoup(response.text, "html.parser")
        
        # Extract title BEFORE cleaning (so we don't lose it)
        title = soup.title.string if soup.title else ""
        if title:
            title = title.strip()
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Try multiple strategies to extract meaningful content
        html_content = None
        
        # Strategy 1: Look for main content areas
        main_content_selectors = [
            'main', '[role="main"]', '.main-content', '.content', 
            'article', '.article', '#content', '.page-content',
            '.post-content', '.entry-content'
        ]
        
        for selector in main_content_selectors:
            elements = soup.select(selector)
            if elements and elements[0].get_text(strip=True):
                html_content = str(elements[0])
                print(f"[DEBUG] Found content using selector: {selector}")
                break
        
        # Strategy 2: If no main content found, get body
        if not html_content or len(BeautifulSoup(html_content, "html.parser").get_text(strip=True)) < 50:
            body = soup.find('body')
            if body:
                html_content = str(body)
                print(f"[DEBUG] Extracted HTML from body")
            else:
                html_content = str(soup)
                print(f"[DEBUG] Extracted HTML from entire document")
        
        # ✅ CLEAN HTML: Remove navigation, footer, images
        if html_content:
            content_soup = BeautifulSoup(html_content, "html.parser")
            content_soup = clean_html_for_content(content_soup)
            html_content = str(content_soup)

        # Convert HTML to Markdown (using ATX-style headings with #)
        markdown_content = md(html_content, heading_style="ATX") if html_content else ""

        # Clean up excessive newlines
        markdown_content = re.sub(r'\n{3,}', '\n\n', markdown_content)
        markdown_content = markdown_content.strip()

        # Also keep plain text for word count
        text = BeautifulSoup(html_content, "html.parser").get_text(separator=' ', strip=True) if html_content else ""
        text = ' '.join(text.split())  # Normalize whitespace
        
        print(f"[DEBUG] Static scraping results for {url}:")
        print(f"[DEBUG] - Title: {title}")
        print(f"[DEBUG] - Markdown length: {len(markdown_content)} characters")
        print(f"[DEBUG] - Text length: {len(text)} characters")
        
        if not title and text:
            title = extract_page_title(text)  
        word_count = len(text.split())
        print(f"[DEBUG] - Word count: {word_count}")
        
        return {"url": url, "title": title, "text": text, "markdown": markdown_content, "word_count": word_count}

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
            
            # Improved browser configuration
            browser = p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled'
                ]
            )
            
            # Better context configuration
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport={'width': 1920, 'height': 1080},
                extra_http_headers={
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                }
            )
            
            page = context.new_page()
            
            # Set longer timeout for complex sites
            page.set_default_timeout(60000)
            
            print(f"[DEBUG] Navigating to {url}")
            
            # Try different loading strategies
            try:
                # Strategy 1: Load with 'load' event (faster, works for most sites)
                page.goto(url, wait_until='load', timeout=30000)
                print(f"[DEBUG] Page loaded with 'load' event")
                
                # Wait for JavaScript frameworks to initialize
                time.sleep(8)
                
            except Exception as load_error:
                print(f"[DEBUG] Load strategy failed: {load_error}")
                try:
                    # Strategy 2: Fallback to networkidle with shorter timeout
                    print(f"[DEBUG] Trying networkidle strategy")
                    page.goto(url, wait_until='networkidle', timeout=20000)
                    print(f"[DEBUG] Page loaded with networkidle")
                except Exception as networkidle_error:
                    print(f"[DEBUG] Networkidle strategy also failed: {networkidle_error}")
                    # Strategy 3: Basic domcontentloaded + wait
                    page.goto(url, wait_until='domcontentloaded', timeout=15000)
                    time.sleep(10)
                    print(f"[DEBUG] Page loaded with domcontentloaded + wait")

            print(f"[DEBUG] Page navigation completed for {url}")
            
            # Try to wait for common content indicators
            try:
                # Wait for any substantial content to appear
                page.wait_for_function(
                    "() => document.body && document.body.innerText.length > 100",
                    timeout=15000
                )
                print(f"[DEBUG] Content appeared")
            except:
                print(f"[DEBUG] Content wait timeout, proceeding anyway")
            
            # Extract title
            title = page.title() or ""
            
            # ✅ REMOVE HIDDEN ELEMENTS FROM DOM (using browser's rendering logic)
            try:
                print(f"[DEBUG] Removing hidden elements from DOM using browser logic...")
                removed_count = page.evaluate("""
                    () => {
                        let count = 0;
                        // Remove all elements that are not visible (using browser's rendering logic)
                        const allElements = document.querySelectorAll('*');
                        allElements.forEach(el => {
                            const style = window.getComputedStyle(el);
                            // Check if element is hidden by CSS
                            if (
                                style.display === 'none' ||
                                style.visibility === 'hidden' ||
                                style.opacity === '0' ||
                                el.hidden ||
                                el.getAttribute('aria-hidden') === 'true'
                            ) {
                                el.remove();
                                count++;
                            }
                        });
                        return count;
                    }
                """)
                print(f"[DEBUG] Removed {removed_count} hidden elements from DOM")
            except Exception as e:
                print(f"[DEBUG] Could not remove hidden elements: {e}")

            # Try to get HTML content
            html_content = None
            
            # Strategy 1: Try to find main content areas
            main_selectors = [
                'main', '[role="main"]', '.main-content', '.content',
                'article', '.page-content', '#content'
            ]
            
            for selector in main_selectors:
                try:
                    elements = page.query_selector_all(selector)
                    if elements:
                        html_content = page.inner_html(selector)
                        if len(BeautifulSoup(html_content, "html.parser").get_text(strip=True)) > 100:
                            print(f"[DEBUG] Found content using selector: {selector}")
                            break
                except:
                    continue
            
            # Strategy 2: Extract from body if main content not found
            if not html_content or len(BeautifulSoup(html_content, "html.parser").get_text(strip=True)) < 100:
                try:
                    html_content = page.inner_html("body")
                    print(f"[DEBUG] Extracted HTML from body")
                except:
                    pass
            
            # Remove script and style tags from HTML
            if html_content:
                soup = BeautifulSoup(html_content, "html.parser")
                for script in soup(["script", "style"]):
                    script.decompose()

                # ✅ CLEAN HTML: Remove navigation, footer, images
                soup = clean_html_for_content(soup)
                html_content = str(soup)
            
            # Convert HTML to Markdown (using ATX-style headings with #)
            markdown_content = md(html_content, heading_style="ATX") if html_content else ""

            # Clean up excessive newlines
            markdown_content = re.sub(r'\n{3,}', '\n\n', markdown_content)
            markdown_content = markdown_content.strip()
            
            # Also get plain text for word count
            text = BeautifulSoup(html_content, "html.parser").get_text(separator=' ', strip=True) if html_content else ""
            text = ' '.join(text.split())
            
            print(f"[DEBUG] Dynamic scraping results for {url}:")
            print(f"[DEBUG] - Title: {title}")
            print(f"[DEBUG] - Markdown length: {len(markdown_content)} characters")
            print(f"[DEBUG] - Text length: {len(text)} characters")
            
            if not title and text:
                title = extract_page_title(text)            
            word_count = len(text.split()) if text else 0
            print(f"[DEBUG] - Word count: {word_count}")
            
            browser.close()
            return {"url": url, "title": title, "text": text, "markdown": markdown_content, "word_count": word_count}
            
    except Exception as e:
        print(f"[ERROR] Error scraping {url} with Playwright: {e}")
        import traceback
        print(f"[ERROR] Playwright scraping traceback: {traceback.format_exc()}")
        return None

# Hybrid scraping function
def scrape_selected_nodes2(url_list, bot_id, db: Session):
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
                # If result is None or text is empty, fallback to dynamic
                if not result or not result.get("text"):
                    logger.warning(f"Static scraping failed or returned empty text. Falling back to dynamic scraping.",
                                extra={"bot_id": bot_id, "url": url})
                    result = scrape_dynamic_page(url)

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
                        
                        # Split text into chunks for embedding
                        text_chunks = chunk_text(result["text"])
                        logger.info(f"Split text into {len(text_chunks)} chunks", 
                                  extra={"bot_id": bot_id, "url": url})
                        
                        # Store each chunk with proper metadata
                        for i, chunk in enumerate(text_chunks):
                            chunk_metadata = metadata.copy()
                            # Add chunk-specific metadata
                            chunk_metadata["id"] = f"{website_id}_{i}" if len(text_chunks) > 1 else website_id
                            chunk_metadata["chunk_number"] = i + 1
                            chunk_metadata["total_chunks"] = len(text_chunks)
                            
                            if user_id:
                                logger.info(f"Adding chunk {i+1}/{len(text_chunks)} to vector DB", 
                                          extra={"bot_id": bot_id, "url": url, "user_id": user_id})
                                add_document(bot_id, text=chunk, metadata=chunk_metadata, user_id=user_id)
                            else:
                                logger.warning(f"No user_id found for bot, adding chunk without user context", 
                                            extra={"bot_id": bot_id, "url": url})
                                add_document(bot_id, text=chunk, metadata=chunk_metadata)
                        
                        logger.info(f"Successfully added document chunks to vector DB", 
                                  extra={"bot_id": bot_id, "url": url, 
                                        "document_id": website_id, "chunk_count": len(text_chunks)})
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
                send_web_scraping_failure_notification(db=db,bot_id=bot_id,reason=f"URL '{url}' failed. No content was scraped.")

        except Exception as e:
            logger.error(f"Unexpected error processing URL", 
                       extra={"bot_id": bot_id, "url": url, "error": str(e)})
            import traceback
            logger.error(f"Processing traceback", 
                       extra={"bot_id": bot_id, "url": url, 
                             "traceback": traceback.format_exc()})
            failed_urls.append(url)
            send_web_scraping_failure_notification(db=db,bot_id=bot_id,reason=f"URL '{url}' failed with error: {str(e)}")
    
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

def validate_links(links: List[str]) -> List[str]:
    valid_links = []
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/114.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://google.com"  # Helps fool some strict filters
    }

    for url in links:
        try:
            response = requests.get(url, headers=headers, timeout=7, allow_redirects=True)
            if response.status_code < 400:
                valid_links.append(url)
            else:
                print(f"[SKIP] {url} returned {response.status_code}")
        except Exception as e:
            print(f"[ERROR] Failed to check {url} - {e}")
    return valid_links

def normalize_url(url):
    """Normalize a URL by removing fragments, sorting query params, and stripping trailing slashes."""
    url, _ = urldefrag(url)  # Remove fragment
    parsed = urlparse(url)

    # Normalize query params
    query = urlencode(sorted(parse_qsl(parsed.query)))

    # Remove trailing slash from path (optional, depends on your use-case)
    path = parsed.path.rstrip('/')

    normalized = urlunparse((
        parsed.scheme,
        parsed.netloc,
        path,
        parsed.params,
        query,
        ''  # fragment removed
    ))
    return normalized


def get_website_nodes(base_url):
    """
    Extracts internal links (nodes) from the homepage only.
    Uses static scraping first, then Playwright for JS-heavy sites.
    Returns: {"nodes": [...]} or {"error": "..."}
    """
    base_url = normalize_url(base_url)

    def static_scrape():
        try:
            response = requests.get(base_url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
            if response.status_code != 200:
                return []
            soup = BeautifulSoup(response.text, "html.parser")
            links = set()
            for link in soup.find_all("a", href=True):
                full_url = urljoin(base_url, link["href"])
                if urlparse(full_url).netloc == urlparse(base_url).netloc:
                    normalized = normalize_url(full_url)
                    if not normalized.lower().endswith(NON_HTML_EXTENSIONS):
                        links.add(normalized)
            return list(links)
        except Exception as e:
            print(f"[STATIC ERROR] {base_url} - {e}")
            return []

    def dynamic_scrape():

        try:
            print("DynamicScrape:", base_url)
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                page = context.new_page()
                page.goto(base_url, timeout=30000)
                page.wait_for_load_state("networkidle")

                # Get all href values from <a> tags
                all_links = page.eval_on_selector_all("a[href]", "els => els.map(el => el.href)")
                print(f"[DEBUG] Found {len(all_links)} raw links on {base_url}")

                internal_links = set()
                base_domain = urlparse(base_url).netloc

                for link in all_links:
                    parsed = urlparse(link)

                    # Keep only http/https links from the same domain
                    if parsed.scheme in ("http", "https") and parsed.netloc == base_domain:
                        # Remove fragments (e.g., #section) for consistency
                        # clean_url, _ = urldefrag(link)
                        # internal_links.add(clean_url)
                        normalized = normalize_url(link)
                        if not normalized.lower().endswith(NON_HTML_EXTENSIONS):
                            internal_links.add(normalized)

                browser.close()
                print(f"[INFO] Total internal nodes found Dynamic: {len(internal_links)}")
                return list(internal_links)

        except Exception as e:
            print(f"[PLAYWRIGHT ERROR] {base_url} - {e}")
            return []

    try:

        links = dynamic_scrape()

        if not links:
            print(f"[INFO] No links found from Dynamic Scraping .Trying with Static Scraping.")
            links = static_scrape()

        if not links:
            print(f"[INFO] No links found. Treating as standalone.")
            return {"nodes": [base_url]}

        links = set(links)

        print(f"[INFO] Total internal nodes found: {len(links)}")
        return {"nodes": list(links)}

    except Exception as e:
        print(f"[FATAL ERROR] {e}")
        return {"error": str(e)}

def get_links_from_sitemap(base_url: str, timeout: int = 10, max_retries: int = 2) -> List[str]:
    base_url = normalize_url(base_url)
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})

    def fetch_with_retry(url: str, retries: int = max_retries) -> Optional[requests.Response]:
        for attempt in range(retries):
            try:
                resp = session.get(url, timeout=timeout)
                if resp.status_code == 200:
                    return resp
                elif resp.status_code == 404:
                    return None
            except (requests.RequestException, ConnectionError) as e:
                print(f"[RETRY {attempt + 1}] Failed to fetch {url}: {e}")
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)
        return None

    def parse_sitemap(content: str) -> List[str]:
        soup = BeautifulSoup(content, "xml")
        urls = []
        nested_sitemaps = []

        if soup.find("urlset"):
            for url_tag in soup.find_all("url"):
                loc = url_tag.find("loc")
                if loc and loc.text.strip():
                    urls.append(loc.text.strip())
        elif soup.find("sitemapindex"):
            for sitemap_tag in soup.find_all("sitemap"):
                loc = sitemap_tag.find("loc")
                if loc and loc.text.strip():
                    nested_sitemaps.append(loc.text.strip())

            # 🔄 Parallel fetching of nested sitemaps
            with ThreadPoolExecutor(max_workers=5) as executor:
                results = list(executor.map(fetch_and_parse_sitemap, nested_sitemaps))
                for r in results:
                    urls.extend(r or [])

        return urls

    def fetch_and_parse_sitemap(sitemap_url: str) -> List[str]:
        resp = fetch_with_retry(sitemap_url)
        if not resp:
            return []
        return parse_sitemap(resp.content)

    sitemap_candidates = [
        urljoin(base_url, "sitemap.xml"),
        urljoin(base_url, "sitemap_index.xml"),
        urljoin(base_url, "wp-sitemap.xml"),
        urljoin(base_url, "sitemap1.xml"),
        urljoin(base_url, "sitemap-index.xml"),
        urljoin(base_url, "sitemap.txt"),
        urljoin(base_url, "sitemap.json"),
    ]

    robots_url = urljoin(base_url, "robots.txt")
    robots_resp = fetch_with_retry(robots_url)
    if robots_resp:
        for line in robots_resp.text.splitlines():
            if line.lower().startswith("sitemap:"):
                sitemap_url = line.split(":", 1)[1].strip()
                sitemap_candidates.insert(0, sitemap_url)

    all_urls = []
    for sitemap_url in sitemap_candidates:
        print(f"[INFO] Checking sitemap: {sitemap_url}")
        urls = fetch_and_parse_sitemap(sitemap_url)
        if urls:
            print(f"[SUCCESS] Found {len(urls)} URLs in {sitemap_url}")
            all_urls.extend(urls)

    return list(set(
    url for url in all_urls
    if not re.search(r"\.(pdf|jpg|jpeg|png|gif|webp|svg|bmp|ico|xml|txt|json|csv)(\?|$)", url, re.IGNORECASE)
))

def save_scraped_nodes(url_list, bot_id, db: Session, action_user_id: int = None):
    """Save scraped URLs and titles to the database with the associated bot_id."""
    print("save_scraped_nodes")

    if bot_id is None:
        print(" Error: bot_id cannot be None!")
        return  # Stop execution if bot_id is None

    try:
        if url_list:  # Only proceed if there are URLs
            # Extract domain from first URL
            first_url = url_list[0]["url"]
            print("first_url")
            domain = urlparse(first_url).netloc
            print("domain",domain)
            
            # Check if website exists or create it
            website = db.query(WebsiteDB).filter(
                WebsiteDB.domain == domain,
                WebsiteDB.bot_id == bot_id,
                WebsiteDB.is_deleted == False
            ).first()
            
            if not website:
                print(f"❌ Website '{domain}' not found or was deleted for bot_id={bot_id}. Skipping all updates.")
                return  # Exit early if the website is not valid

        # Decide content mode once per save based on bot setting
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        use_markdown_chunking = bool(bot and bot.markdown_chunking is True)

        for item in url_list:
            url = item["url"]
            title = item.get("title", "No Title")  # Default to "No Title" if missing
            word_count = item["word_count"]
            # Choose content based on markdown_chunking setting
            content_for_node = (
                item.get("markdown", item.get("text", ""))
                if use_markdown_chunking
                else item.get("text", "")
            )
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
                
                # Update nodes_text field based on configured content mode
                existing_node.nodes_text = content_for_node
                existing_node.nodes_text_count = word_count
                existing_node.status = "Extracted"
                existing_node.updated_by = action_user_id
                existing_node.last_embedded = None
                print("Website node updated with", "markdown content" if use_markdown_chunking else "text content")
                #Add notification only for existing and updated nodes
                event_type = "SCRAPED_URL_SAVED"
                event_data = f"URL '{url}' for bot added successfully. {word_count} words extracted."
                add_notification(
                    
                    db=db,
                    event_type=event_type,
                    event_data=event_data,
                    bot_id=bot_id,
                    user_id=None
                )
            else:
                print(f"⚠️ Node for URL not found in DB (maybe deleted): {url}. Skipping insert.")
                continue  # Don't insert, just move to the next

        db.commit()  # Commit changes to the database
        print("✅ Scraped nodes with titles saved successfully!")

    except Exception as e:
        db.rollback()  # Rollback in case of an error
        print(f"❌ Error saving nodes: {e}")
    finally:
        db.close()  # Close the session

def get_scraped_urls_func(bot_id, db: Session):
    scraped_nodes = db.query(ScrapedNode.url, ScrapedNode.title, ScrapedNode.nodes_text_count,ScrapedNode.created_at, ScrapedNode.status, ScrapedNode.error_code).filter(
        ScrapedNode.bot_id == bot_id,
        ScrapedNode.is_deleted == False
    ).all()
    print("Scrapped Node=>",scraped_nodes)
    return [{"url": node[0], "title": node[1], "Word_Counts": node[2], "upload_date": node[3], "status": node[4], "error_code": node[5] } for node in scraped_nodes]  # Extract URL & Title

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


# Hybrid scraping function
def scrape_selected_nodes(url_list, bot_id, db: Session, action_user_id: int = None):
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
                print("result",result)
            else:
                logger.info(f"Static HTML detected - Using BeautifulSoup", extra={"bot_id": bot_id, "url": url})
                result = scrape_static_page(url)
                print("result",result)
                # If result is None or text is empty, fallback to dynamic
                if not result or not result.get("text"):
                    logger.warning(f"Static scraping failed or returned empty text. Falling back to dynamic scraping.",
                                extra={"bot_id": bot_id, "url": url})
                    result = scrape_dynamic_page(url)

            if result:
                logger.info(f"Successfully scraped URL",
                          extra={"bot_id": bot_id, "url": url, "title": result.get("title", "No Title")})
                crawled_data.append(result)

                if result["text"]:
                    logger.info(f"Extracted text content",
                              extra={"bot_id": bot_id, "url": url,
                                   "word_count": result["word_count"],
                                   "text_length": len(result["text"])})
                    print("word_count", result["word_count"])
                    print("text", result["text"])

                else:
                    logger.warning(f"No text content extracted",
                                 extra={"bot_id": bot_id, "url": url})
            else:
                logger.warning(f"No content was scraped", extra={"bot_id": bot_id, "url": url})
                failed_urls.append(url)
                send_web_scraping_failure_notification(db=db,bot_id=bot_id,reason=f"URL '{url}' failed. No content was scraped.")

        except Exception as e:
            logger.error(f"Unexpected error processing URL",
                       extra={"bot_id": bot_id, "url": url, "error": str(e)})
            import traceback
            logger.error(f"Processing traceback",
                       extra={"bot_id": bot_id, "url": url,
                             "traceback": traceback.format_exc()})
            failed_urls.append(url)
            send_web_scraping_failure_notification(db=db,bot_id=bot_id,reason=f"URL '{url}' failed with error: {str(e)}")

    logger.info(f"Scraping completed",
              extra={"bot_id": bot_id, "successful": len(crawled_data),
                   "failed": len(failed_urls)})

    if crawled_data:
        try:
            total_word_count = sum(item["word_count"] for item in crawled_data)
            bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
            user_id = bot.user_id if bot else None
            if not action_user_id:
                # Get bot owner as fallback
                action_user_id = bot.user_id if bot else None

            for item in crawled_data:
                try:
                    # Validate this node's word count
                    validate_cumulative_word_count_sync_for_celery(
                        item["word_count"],
                        {"user_id": user_id},
                        db
                    )
                    # ✅ Save single node
                    save_scraped_nodes([item], bot_id, db, action_user_id )

                except Exception as wc_error:
                    # ❌ Mark this node as failed
                    logger.warning(f"❌ Word count exceeded for URL. Marking as FAILED", extra={
                        "bot_id": bot_id,
                        "url": item["url"],
                        "error": str(wc_error)
                    })

                    node = db.query(ScrapedNode).filter(
                        ScrapedNode.bot_id == bot_id,
                        ScrapedNode.url == item["url"],
                        ScrapedNode.is_deleted == False
                    ).first()

                    if node:
                        node.status = "Failed"
                        node.error_code = "Word count exceeds your subscription plan limit."
                        # Decide content mode based on bot setting
                        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
                        use_markdown_chunking = bool(bot and bot.markdown_chunking is True)
                        node.nodes_text = (
                            item.get("markdown", item.get("text", ""))
                            if use_markdown_chunking
                            else item.get("text", "")
                        )
                        node.title = item.get("title", "No Title")
                        node.updated_at = datetime.utcnow()
                        node.updated_by = action_user_id
                        db.commit()

                    send_web_scraping_failure_notification(
                        db=db,
                        bot_id=bot_id,
                        reason=f"Word count exceeded for URL: {item['url']}"
                    )
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

     # Mark all failed URLs in the database
    if failed_urls:
        logger.info(f"Marking {len(failed_urls)} URLs as FAILED in database", extra={"bot_id": bot_id})
        try:
            mark_scraped_nodes_failed(
                db=db,
                bot_id=bot_id,
                urls=failed_urls,
                error_message="Extraction Failed"
            )
        except Exception as mark_fail_err:
            logger.error("❌ Failed to mark URLs as FAILED", extra={
                "bot_id": bot_id,
                "error": str(mark_fail_err)
            })

    return crawled_data

def mark_scraped_nodes_failed(db: Session, bot_id: int, urls: list, error_message: str):
    try:
        for url in urls:
            node = db.query(ScrapedNode).filter(
                ScrapedNode.url == url,
                ScrapedNode.bot_id == bot_id,
                ScrapedNode.is_deleted == False
            ).first()
            if node:
                node.status = "Failed"
                node.error_code = error_message
        db.commit()
    except Exception as e:
        import traceback
        print(f"❌ Failed to mark scraped nodes as FAILED for bot {bot_id}: {str(e)}")
        print(traceback.format_exc())
