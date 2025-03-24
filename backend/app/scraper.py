import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
from app.models import ScrapedNode  # Import the model
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from fastapi import Depends
from app.database import get_db


# Function to detect if JavaScript is needed
def is_js_heavy(url):
    """
    Check if the website is JavaScript-heavy by looking for script tags.
    """
    try:
        response = requests.get(url, timeout=5)
        if "<script" in response.text.lower() or "react" in response.text.lower() or "angular" in response.text.lower():
            return True
    except:
        return True
    return False

# Static website scraping (BeautifulSoup)
def scrape_static_page(url):
    try:
        response = requests.get(url, timeout=5)
        if response.status_code != 200:
            return None

        soup = BeautifulSoup(response.text, "html.parser")
        title = soup.title.string if soup.title else "No Title"
        text = " ".join([p.get_text() for p in soup.find_all("p")])
        return {"url": url, "title": title,"text": text}

    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None

# JavaScript-heavy website scraping (Playwright)
def scrape_dynamic_page(url):
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, timeout=10000)
            page.wait_for_load_state("networkidle")
            title = page.title()  # Extract the page title
            text = page.inner_text("body")
            browser.close()
            return {"url": url, "title": title,"text": text}
    except Exception as e:
        print(f"Error scraping {url} with Playwright: {e}")
        return None

# Hybrid scraping function
def scrape_selected_nodes(url_list,bot_id,db: Session):
    print("scrape_selected_nodes")
    crawled_data = []
    crawled_urls = []  # Separate list to store only URLs
    #save_scraped_nodes(url_list,bot_id,db)  # Save URLs to DB
    
    for url in url_list:
        if is_js_heavy(url):
            print(f"🔵 JavaScript detected - Using Playwright for {url}")
            result = scrape_dynamic_page(url)
        else:
            print(f"🟢 Static HTML detected - Using BeautifulSoup for {url}")
            result = scrape_static_page(url)
        print("result",result)

        if result:
            title = extract_page_title(result["text"])  # Extract title from page conten
            # title = result.pop("title", "No Title")  # Extract title but do not return it
            crawled_data.append(result)
            crawled_urls.append({"url": url, "title": title})  # Store only URLs for saving

        #Below lines(80 - 82 should be removed when it successfuly extracts data )    
        title = "No title"  # Extract title from page conten
        crawled_urls.append({"url": url, "title": title})  # Store only URLs for saving
        print(crawled_urls)
    

    if crawled_urls:
        save_scraped_nodes(crawled_urls,bot_id, db)  # Save URLs to DB

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
        for item in url_list:
            url = item["url"]
            title = item.get("title", "No Title")  # Default to "No Title" if missing
            print("title",title)
            print("url",url)

            # Check if URL already exists for the given bot_id
            existing_node = db.query(ScrapedNode).filter(
                ScrapedNode.url == url,
                ScrapedNode.bot_id == bot_id  # ✅ Ensure uniqueness per bot_id
            ).first()
            print(existing_node)

            if existing_node:
                # Update title if it's missing or outdated
                if not existing_node.title or existing_node.title != title:
                    existing_node.title = title
                else:
                    print("Website node already craled")
            else:
                print("New")
                # Insert new record
                new_node = ScrapedNode(url=url, title=title, bot_id=bot_id)
                db.add(new_node)

        db.commit()  # Commit changes to the database
        print("✅ Scraped nodes with titles saved successfully!")

    except Exception as e:
        db.rollback()  # Rollback in case of an error
        print(f"❌ Error saving nodes: {e}")
    finally:
        db.close()  # Close the session

def get_scraped_urls_func(bot_id, db: Session):
    scraped_nodes = db.query(ScrapedNode.url, ScrapedNode.title).filter(
        ScrapedNode.bot_id == bot_id,
        ScrapedNode.is_deleted == False
    ).all()

    return [{"url": node[0], "title": node[1]} for node in scraped_nodes]  # Extract URL & Title

def extract_page_title(html_content):
    """Extracts the title from HTML content."""
    soup = BeautifulSoup(html_content, "html.parser")
    title_tag = soup.find("title")
    return title_tag.text.strip() if title_tag else "No Title"
