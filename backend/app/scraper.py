import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

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
        text = " ".join([p.get_text() for p in soup.find_all("p")])
        return {"url": url, "text": text}

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
            text = page.inner_text("body")
            browser.close()
            return {"url": url, "text": text}
    except Exception as e:
        print(f"Error scraping {url} with Playwright: {e}")
        return None

# Hybrid scraping function
def scrape_selected_nodes(url_list):
    crawled_data = []
    
    for url in url_list:
        if is_js_heavy(url):
            print(f"🔵 JavaScript detected - Using Playwright for {url}")
            result = scrape_dynamic_page(url)
        else:
            print(f"🟢 Static HTML detected - Using BeautifulSoup for {url}")
            result = scrape_static_page(url)

        if result:
            crawled_data.append(result)

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