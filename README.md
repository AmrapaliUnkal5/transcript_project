# 🤖 Chatbot
**Optimized Pluggable Chatbot Solution**

## Project Structure
This project is a comprehensive chatbot application divided into two core components:
* **Frontend**: React TypeScript application built with Vite
* **Backend**: FastAPI-powered API service with ChromaDB & OpenAI GPT

### Directory Layout
```
Chatbot/
├── backend/
│   ├── app/           # Main application code
│   ├── venv/          # Virtual environment
│   ├── .env           # Environment configuration
│   └── requirements.txt # Python dependencies
├── frontend/
│   ├── src/           # Source code
│   ├── public/        # Public assets
│   ├── vite.config.ts # Vite configuration
│   └── package.json   # Node.js dependencies
```

## 🚀 Project Setup

### Backend Setup

#### Prerequisites
* Python 3.8+
* pip
* Virtual environment support
* **System dependencies**:
  * `ffmpeg` (Required for YouTube video processing)
  * `playwright` (Required for web scraping)
  * `redis` (Required for background processing)
  * `tesseract-ocr` (Required for image text extraction)

#### Installation Steps
1. Navigate to backend directory
   ```bash
   cd backend
   ```

2. Install **system dependencies**
   * **Ubuntu/Debian**:
     ```bash
     sudo apt update && sudo apt install -y ffmpeg redis-server tesseract-ocr
     ```
   * **macOS (Homebrew)**:
     ```bash
     brew install ffmpeg redis tesseract
     ```
   * **Windows**:
     1. Download ffmpeg
     2. Extract and **add** `ffmpeg/bin` to your system `PATH`
     3. Download and install Redis for Windows from https://github.com/tporadowski/redis/releases
     4. Download and install Tesseract from https://github.com/UB-Mannheim/tesseract/wiki
     5. Add Tesseract installation directory to your system `PATH`
     6. Verify installation:
        ```bash
        ffmpeg -version
        redis-cli --version
        tesseract --version
        ```

3. Create virtual environment
   ```bash
   python3 -m venv venv
   ```

4. Activate virtual environment
   * **macOS/Linux**: `source venv/bin/activate`
   * **Windows**: `venv\Scripts\activate`

5. Install dependencies
   ```bash
   pip install -r requirements.txt
   ```

6. Install `playwright` dependencies
   ```bash
   playwright install
   ```

7. Configure Environment
   Create a `.env` file with:
   ```
   OPENAI_API_KEY=your-openai-api-key
   DATABASE_URL=postgresql://username:password@localhost/dbname
   CHROMADB_PATH=/path/to/chromadb
   ```

8. Run Backend Server
   ```bash
   uvicorn app.main:app --reload
   ```

#### Troubleshooting
* **Import Error**: Ensure you're in the backend directory
* **Module Not Found**: Verify PYTHONPATH and project structure
* `ffmpeg` Not Found:
  * Install `ffmpeg` using commands above
* **Playwright Issues**: Run `playwright install` again

### Frontend Setup

#### Prerequisites
* Node.js 16+
* npm

#### Installation Steps
1. Navigate to frontend directory
   ```bash
   cd frontend
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Development Server
   ```bash
   npm run dev
   ```

4. Production Build
   ```bash
   npm run build
   ```

5. Preview Production Build
   ```bash
   npm run preview
   ```

## 🔗 URLs
* **Frontend**: http://localhost:5173
* **Backend API**: http://localhost:8000
* **Flower Dashboard**: http://localhost:5555 (for monitoring async tasks)

## 🛠 Common Issues & Solutions

### Backend
* **Database Connection**:
  * Verify `.env` credentials
  * Ensure database server is running
* **ChromaDB Storage Issue**:
  * Check `CHROMADB_PATH` in `.env`
* `ffmpeg` Not Found:
  * Install `ffmpeg` using commands above
* **Redis Connection Error**:
  * Ensure Redis server is running
* **Tesseract OCR Error** ("tesseract is not installed or it's not in your PATH"):
  * Install tesseract-ocr using the commands above
  * Verify with `tesseract --version`
  * For Windows, ensure Tesseract is in your PATH

### Frontend
* **API Data Fetching**:
  * Check backend server URL configuration
* **CORS Errors**:
  * Add CORS middleware to FastAPI

## 🚀 Asynchronous Processing System

The chatbot application uses Celery for background processing of resource-intensive tasks. This approach provides immediate feedback to users while handling time-consuming operations in the background.

### Supported Async Tasks

1. **YouTube Video Processing**
   - Extracts transcripts from YouTube videos using Apify API
   - Processes and stores them in ChromaDB for search
   - Sends notifications on completion

2. **File Upload Processing**
   - Processes document uploads in the background
   - Extracts text and stores in vector database
   - Updates users via notifications

3. **Web Scraping**
   - Scrapes website content asynchronously
   - Processes HTML content into usable knowledge
   - Supports multiple URLs in a single request

### Key Features

- **Immediate Response**: Users receive instant confirmation when operations are initiated
- **Background Processing**: Tasks run asynchronously without blocking the interface
- **Status Tracking**: Each task has defined states (pending, processing, completed, failed)
- **Notification System**: Users are informed about task progress and completion
- **Error Handling**: Robust error management with automatic retries
- **Monitoring**: Flower dashboard for task monitoring and management

## 🔧 Celery, Redis and Flower Setup

Celery is used for task queuing, Redis as the message broker, and Flower for monitoring.

### Ubuntu Setup (Using Scripts)

The project includes ready-to-use scripts for Ubuntu in the `backend/scripts` directory:

1. **Complete Setup**
   ```bash
   cd backend
   ./scripts/setup.sh
   ```
   This installs Redis, configures the environment, and prepares the system.

2. **Start Individual Components**
   ```bash
   # Start Redis
   ./scripts/run_redis.sh start

   # Start Celery Worker
   ./scripts/run_celery.sh

   # Start Flower Dashboard
   ./scripts/run_flower.sh
   ```

3. **Stop Redis**
   ```bash
   ./scripts/run_redis.sh stop
   ```

4. **Check Redis Status**
   ```bash
   ./scripts/run_redis.sh status
   ```

### Manual Setup (macOS)

1. **Install Redis**
   ```bash
   brew install redis
   ```

2. **Start Redis**
   ```bash
   brew services start redis
   ```

3. **Start Celery Worker**
   ```bash
   cd backend
   source venv/bin/activate
   celery -A app.celery_app worker --loglevel=info --concurrency=2
   ```

4. **Start Flower Dashboard**
   ```bash
   celery -A app.celery_app flower --port=5555
   ```

### Manual Setup (Windows)

1. **Install Redis**
   - Download Redis for Windows from https://github.com/tporadowski/redis/releases

2. **Start Celery Worker**
   ```bash
   cd backend
   venv\Scripts\activate
   celery -A app.celery_app worker --loglevel=info --concurrency=2 --pool=solo
   ```
   Note: Windows requires `--pool=solo` option

3. **Start Flower Dashboard**
   ```bash
   celery -A app.celery_app flower --port=5555
   ```

## Using Asynchronous Features

### YouTube Video Processing

1. **Frontend**: Upload YouTube URLs in the YouTube Uploader page
2. **API Endpoint**: `POST /youtube-async` with payload containing bot_id and video_urls
3. **Background Process**: Videos are processed, transcripts extracted, and stored in ChromaDB
4. **Notifications**: System notifies users when processing completes

### File Upload Processing

1. **Frontend**: Upload documents through the Knowledge Base page
2. **API Endpoint**: `POST /upload` with multipart form data
3. **Background Process**: Files are validated, processed, and added to the knowledge base
4. **Notifications**: Users receive notifications about upload status

### Web Scraping

1. **Frontend**: Enter website URLs in the Website Scraping page
2. **API Endpoint**: `POST /scrape-async` with payload containing bot_id and selected_nodes (URLs)
3. **Background Process**: Websites are scraped, content extracted, and added to the knowledge base
4. **Notifications**: System notifies users when scraping completes

## 🎬 YouTube Transcript Extraction

The application supports extraction of transcripts from YouTube videos for use in the chatbot's knowledge base.

### Apify Integration

The system uses Apify's YouTube Transcript Extractor to reliably retrieve transcripts, which works across various environments including AWS servers where YouTube's official API might be blocked.

#### Setup Requirements

1. **Get an Apify API Token**:
   - Create an account at [Apify](https://apify.com)
   - Generate an API token from your Apify dashboard

2. **Configure Environment**:
   - Add your Apify API token to the `.env` file:
   ```
   APIFY_API_TOKEN=your-apify-api-token
   ```

3. **Install Dependencies**:
   - The `apify-client` package is included in `requirements.txt`
   - Ensure it's installed with: `pip install apify-client>=1.4.0`

#### Testing the Transcript Extraction

To verify the transcript extraction is working correctly, use the provided test script:

```bash
cd backend
source venv/bin/activate
python scripts/test_youtube_transcript.py https://www.youtube.com/watch?v=VIDEO_ID
```

The script will test both the YouTube Transcript API and the Apify method, allowing you to confirm which method works in your environment.

#### Fallback Mechanism

The system uses a smart fallback approach:

1. First attempts to extract transcripts using Apify (works on all environments)
2. If Apify fails, falls back to the YouTube Transcript API (may not work on AWS)
3. Error handling ensures robust operation even if both methods fail

This dual approach ensures maximum reliability for transcript extraction across all hosting environments.

## 💡 Final Recommendations
* Keep `.env` configurations secure
* Use Node.js 16+
* Regularly update dependencies
* Run `playwright install` for web scraping features
* Ensure Redis is running before starting Celery
* Check the Flower dashboard at http://localhost:5555 for task monitoring