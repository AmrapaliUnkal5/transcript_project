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
from app.subscription_config import get_plan_limits
from app.notifications import add_notification

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
        print("here scrape_static_page ")
        
        response = requests.get(url, timeout=5)
        if response.status_code != 200:
            return None

        soup = BeautifulSoup(response.text, "html.parser")
        title = soup.title.string if soup.title else "No title"
        text = " ".join([p.get_text() for p in soup.find_all("p")])
        if not title:
                title = extract_page_title(text)  
        word_count = len(text.split())
        return {"url": url, "title": title,"text": text,"word_count":word_count}

    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None

# JavaScript-heavy website scraping (Playwright)
def scrape_dynamic_page(url):
    print("here scrape_dynamic_page ")
   
    try:
        with sync_playwright() as p:
           
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, timeout=10000)
            page.wait_for_load_state("networkidle")
            title = page.title()  # Extract the page title           
            text = page.inner_text("body")
            if not title:
                title = extract_page_title(text)            
            word_count = len(text.split())
            browser.close()
            return {"url": url, "title": title,"text": text,"word_count":word_count}
    except Exception as e:
        print(f"Error scraping {url} with Playwright: {e}")
        return None

# Hybrid scraping function
def scrape_selected_nodes(url_list,bot_id,db: Session):
    print("scrape_selected_nodes")
    crawled_data = []
        
    for url in url_list:
        print("url",url)
        if is_js_heavy(url):
            print(f"🔵 JavaScript detected - Using Playwright for {url}")
            result = scrape_dynamic_page(url)
        else:
            print(f"🟢 Static HTML detected - Using BeautifulSoup for {url}")
            result = scrape_static_page(url)
        # print("result",result)
        # text="Contact Us\nPortfolio\nE-commerce platform development for london based company\n\nThe makers of AI have announced the company will be dedicating 20% of its compute processing power over the next four years\n\nIntroduction\n\nIn today's fast-paced and technologically advanced world, businesses rely heavily on Information Technology (IT) services to remain competitive, innovative, and efficient. From streamlining operations to enhancing customer experience\n\nIT services play a crucial role in transforming businesses across all industries. In this blog, we will explore the significance of IT services, the key benefits they offer, and how they can empower your business to reach new heights.\n\nIT services encompass a wide range of solutions aimed at managing, optimizing, and supporting the technology infrastructure of a business. This includes hardware and software management, network administration, cybersecurity, data backup and recovery, cloud services, and more. Whether you run a small startup or a large enterprise, leveraging the right IT services can have a profound impact on your business's success. One of the primary benefits of adopting IT services is their ability to streamline various business operations. Automated processes, such as enterprise resource planning (ERP) systems, can integrate different departments and make data accessible in real-time.\n\nAs businesses increasingly rely on digital technologies, the risk of cyber threats also grows. A robust IT service provider will implement cutting-edge cybersecurity measures to safeguard your valuable data, sensitive information, and intellectual property. From firewall protection to regular vulnerability assessments, a comprehensive security strategy ensures that your business stays protected against cyberattacks.\n\nIn a dynamic business environment, scalability is crucial. IT services provide the flexibility to scale up or down your resources based on changing business needs. Cloud services, for instance, allow seamless expansion of storage and computational power\n\nSerana Belluci\nProduct Designer\n\nCustomer experience has become a key differentiator in today's competitive landscape. IT services enable businesses to personalize customer interactions, provide efficient support through various channels, and offer seamless online experiences.\n\nIT services facilitate data collection, storage, analysis, and visualization, turning raw information into actionable intelligence. By harnessing the power of data analytics, businesses can identify trends, customer preferences, and areas for improvement, leading to more effective strategies and increased profitability. Disruptions, such as natural disasters or system failures, can severely impact a business's operations. IT services include robust disaster recovery and backup solutions, ensuring that critical data is protected and can be swiftly recovered in case of any unforeseen events. This level of preparedness helps maintain business continuity and minimizes downtime,\n\nWhether it's through chatbots, mobile apps, or responsive websites, IT services empower businesses to exceed customer expectations and build lasting relationships. Data is a goldmine of valuable insights that can help businesses make informed decisions.\n\nEnsuring Business Continuity\n\nDisruptions, such as natural disasters or system failures, can severely impact a business's operations. IT services include robust disaster recovery and backup solutions, ensuring that critical data is protected and can be swiftly recovered in case of any unforeseen events.\n\nThis level of preparedness helps maintain business continuity and minimizes downtime, thus safeguarding your reputation and revenue. This includes"       
        # word_count = len(text.split())
        # result = {"url": url, "title": "Portfolio Detail- BytePX Technologies","text": text,"word_count":word_count}

        if result:
            # title = extract_page_title(result["text"])  # Extract title from page conten
            # title = result.pop("title", "No Title")  # Extract title but do not return it
            
            crawled_data.append(result)
            print("crawled_data",crawled_data)
            
            if result["text"]:
                
                update_word_counts(db, bot_id=bot_id, word_count=result["word_count"])
                
                print("crawled_data2",crawled_data)
                website_id = hashlib.md5(result["url"].encode()).hexdigest()  # ✅ Generate unique ID from URL
                metadata = {
                "id": website_id,   # ✅ Ensure unique ID is included
                "source": "website",
                "website_url": result["url"]
                }
                add_document(bot_id, text=result["text"], metadata=metadata)
                
        else:
            print("No text was scraped from the website")
            return 
    

    if crawled_data:
        save_scraped_nodes(crawled_data,bot_id, db)  # Save URLs to DB
        
        #update_word_counts(db, bot_id=bot_id, word_count=20)

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
                else:
                    print("Website node already crawled")
            else:
                print("New")
                # Insert new record
                new_node = ScrapedNode(url=url, title=title, bot_id=bot_id,website_id=website.id,nodes_text_count = word_count if website else None)
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


def update_word_counts(db: Session, bot_id: int, word_count: int):
   
    # Update bot word count
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if bot:
        bot.word_count = (bot.word_count or 0) + word_count

    # Update user's total words used
    user = db.query(User).filter(User.user_id == bot.user_id).first()
    user_subscription = db.query(UserSubscription).filter(UserSubscription.user_id == user.user_id).first()
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
