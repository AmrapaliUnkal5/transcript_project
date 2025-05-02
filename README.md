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

#### Installation Steps
1. Navigate to backend directory
   ```bash
   cd backend
   ```

2. Install **system dependencies**
   * **Ubuntu/Debian**:
     ```bash
     sudo apt update && sudo apt install -y ffmpeg
     ```
   * **macOS (Homebrew)**:
     ```bash
     brew install ffmpeg
     ```
   * **Windows**:
     1. Download ffmpeg
     2. Extract and **add** `ffmpeg/bin` to your system `PATH`
     3. Verify installation:
        ```bash
        ffmpeg -version
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
* `ffmpeg` Not Found: Ensure it's installed and added to `PATH`
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

## 🛠 Common Issues & Solutions

### Backend
* **Database Connection**:
  * Verify `.env` credentials
  * Ensure database server is running
* **ChromaDB Storage Issue**:
  * Check `CHROMADB_PATH` in `.env`
* `ffmpeg` Not Found:
  * Install `ffmpeg` using commands above

### Frontend
* **API Data Fetching**:
  * Check backend server URL configuration
* **CORS Errors**:
  * Add CORS middleware to FastAPI

## 💡 Final Recommendations
* Keep `.env` configurations secure
* Use Node.js 16+
* Regularly update dependencies
* Run `playwright install` for web scraping features

## Asynchronous File Processing

The chatbot application uses Celery for background processing of resource-intensive tasks like file uploads. This approach provides immediate feedback to users while handling potentially time-consuming operations in the background.

### Key Features

1. **Immediate Response**: Users receive instant confirmation when files are uploaded.
2. **Background Processing**: Files are processed asynchronously without blocking the user interface.
3. **Status Notifications**: Users are notified when:
   - File upload is initiated
   - Processing is completed successfully
   - Processing has failed (with error details)
4. **Consistent Interface**: The API maintains the same contract for both synchronous and asynchronous operations.

### Implementation Details

- **Celery Tasks**: Defined in `backend/app/celery_tasks.py` to handle file processing.
- **File Status Tracking**: The `files` table includes an `embedding_status` field to track file processing state.
- **Notification System**: Uses the existing notification infrastructure to keep users informed.

### Similar Implementations

The same pattern is used for:
- YouTube video processing
- File uploads processing
- (Future: any resource-intensive operation)

### Usage Flow

1. User uploads file(s) via the frontend
2. Backend immediately validates and saves the file
3. A Celery task is dispatched to process the file in the background
4. User receives a notification that processing has started
5. When processing completes or fails, user receives another notification
6. File status is updated in the database