# 🎙️ Transcript Project

**AI-Powered Medical Transcript Management System**

A comprehensive platform for managing, transcribing, and analyzing medical/clinical transcripts with intelligent document processing, AI-powered summarization, and semantic search capabilities.

## 📋 Project Overview

This project provides a complete solution for managing transcript records, including:
- **Audio Transcription**: Convert audio files to text using AssemblyAI and OpenAI Whisper
- **Document Processing**: Extract text from PDFs, DOCX files, and images (with OCR)
- **AI Summarization**: Generate intelligent summaries of transcripts
- **Field Extraction**: Automatically extract structured data fields from transcripts
- **Semantic Search**: Search transcripts using vector embeddings and RAG (Retrieval-Augmented Generation)
- **Patient Management**: Organize transcripts by patient with grouping and filtering capabilities

## 🏗️ Project Structure

This project consists of two core components:
* **Frontend**: React TypeScript application built with Vite
* **Backend**: FastAPI-powered API service with PostgreSQL, Qdrant/ChromaDB & OpenAI

### Directory Layout
```
Transcript/
├── backend/
│   ├── app/                    # Main application code
│   │   ├── transcript_project.py  # Core transcript functionality
│   │   ├── vector_db.py        # Vector database operations
│   │   ├── llm_manager.py       # LLM integration
│   │   └── models.py            # Database models
│   ├── venv/                   # Virtual environment
│   ├── .env                    # Environment configuration
│   ├── requirements.txt        # Python dependencies
│   └── transcript_project/     # Uploaded transcript files
├── frontend/
│   ├── src/                    # Source code
│   │   ├── pages/              # React pages
│   │   │   ├── TranscriptUpload.tsx
│   │   │   └── TranscriptWelcome.tsx
│   │   └── services/           # API services
│   ├── public/                 # Public assets
│   ├── vite.config.ts          # Vite configuration
│   └── package.json            # Node.js dependencies
└── README.md                   # This file
```

## 🚀 Project Setup

### Backend Setup

#### Prerequisites
* Python 3.8+
* pip
* Virtual environment support
* PostgreSQL database
* **System dependencies**:
  * `tesseract-ocr` (Required for image text extraction/OCR)
  * `ffmpeg` (Optional, for audio processing)

#### Installation Steps

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install system dependencies**
   * **Ubuntu/Debian**:
     ```bash
     sudo apt update && sudo apt install -y tesseract-ocr ffmpeg
     ```
   * **macOS (Homebrew)**:
     ```bash
     brew install tesseract ffmpeg
     ```
   * **Windows**:
     1. Download and install Tesseract from https://github.com/UB-Mannheim/tesseract/wiki
     2. Add Tesseract installation directory to your system `PATH`
     3. Download ffmpeg and add `ffmpeg/bin` to your system `PATH`
     4. Verify installation:
        ```bash
         tesseract --version
         ffmpeg -version
         ```

3. **Create virtual environment**
   ```bash
   python3 -m venv venv
   ```

4. **Activate virtual environment**
   * **macOS/Linux**: `source venv/bin/activate`
   * **Windows**: `venv\Scripts\activate`

5. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

6. **Configure Environment**
   Create a `.env` file in the `backend` directory with:
   ```env
   # Database
   DATABASE_URL=postgresql://username:password@localhost/dbname
   
   # OpenAI API (for transcription, summarization, and embeddings)
   OPENAI_API_KEY=your-openai-api-key
   
   # Vector Database (Optional - defaults to ChromaDB if not set)
   QDRANT_URL=http://localhost:6333
   QDRANT_API_KEY=your-qdrant-api-key
   
   # File Storage (Optional - defaults to local storage)
   AWS_ACCESS_KEY_ID=your-aws-access-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret-key
   AWS_S3_BUCKET=your-bucket-name
   AWS_REGION=us-east-1
   
   # AssemblyAI (for audio transcription)
   ASSEMBLYAI_API_KEY=your-assemblyai-api-key
   
   # Application Settings
   SECRET_KEY=your-secret-key-for-jwt
   ALGORITHM=HS256
   ```

7. **Initialize Database**
   ```bash
   # Run database migrations (if using Alembic)
   # Or create tables manually using SQLAlchemy models
   ```

8. **Run Backend Server**
   ```bash
   uvicorn app.main:app --reload
   ```

#### Troubleshooting
* **Import Error**: Ensure you're in the backend directory and virtual environment is activated
* **Module Not Found**: Verify all dependencies are installed: `pip install -r requirements.txt`
* **Database Connection**: Verify `.env` credentials and ensure PostgreSQL is running
* **Tesseract OCR Error**: Install tesseract-ocr and verify with `tesseract --version`
* **Vector Database**: Ensure Qdrant is running (if using) or ChromaDB path is accessible

### Frontend Setup

#### Prerequisites
* Node.js 16+
* npm

#### Installation Steps

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API endpoint** (if needed)
   Update the API base URL in `src/services/api.ts` if your backend runs on a different port.

4. **Development Server**
   ```bash
   npm run dev
   ```

5. **Production Build**
   ```bash
   npm run build
   ```

6. **Preview Production Build**
   ```bash
   npm run preview
   ```

## 🔗 URLs
* **Frontend**: http://localhost:5173
* **Backend API**: http://localhost:8000
* **API Documentation**: http://localhost:8000/docs (Swagger UI)

## 🎯 Core Features

### 1. Transcript Record Management
- Create and manage transcript records with patient information
- Store patient details: ID, medical clinic, age, bed number, phone number, visit date
- Track multiple transcripts per patient

### 2. Audio Transcription
- Upload audio files (MP3, WAV, M4A, etc.)
- Automatic transcription using:
  - **Primary**: AssemblyAI API (high accuracy)
  - **Fallback**: OpenAI Whisper API
- Support for various audio formats and quality levels

### 3. Document Processing
- **PDF Processing**: Extract text from PDF documents
- **DOCX/DOC Processing**: Extract text from Word documents
- **Image OCR**: Extract text from images using Tesseract OCR
- **CSV Processing**: Handle CSV files with pandas
- Automatic text extraction and storage

### 4. AI-Powered Features
- **Transcript Summarization**: Generate intelligent summaries using LLM
- **Field Extraction**: Automatically extract structured fields (e.g., diagnosis, medications, symptoms)
- **Semantic Search**: Search transcripts using vector embeddings
- **Context-Aware Retrieval**: RAG-based retrieval for relevant transcript sections

### 5. Vector Database Integration
- **Primary**: Qdrant vector database with scalar quantization
- **Fallback**: ChromaDB for compatibility
- Store transcript embeddings for semantic search
- Patient-specific and user-specific data isolation

### 6. Patient Grouping & Search
- Group transcripts by patient ID
- Search transcripts by patient
- Retrieve context from multiple transcripts for the same patient
- Filter and organize records efficiently

## 🛠️ API Endpoints

### Transcript Records
- `POST /transcript/records` - Create a new transcript record
- `GET /transcript/records` - List all transcript records
- `GET /transcript/records/{record_id}` - Get a specific record
- `PUT /transcript/records/{record_id}` - Update a record
- `DELETE /transcript/records/{record_id}` - Delete a record

### Audio & Transcription
- `POST /transcript/records/{record_id}/audio` - Upload audio file
- `POST /transcript/records/{record_id}/transcribe` - Transcribe audio

### Documents
- `POST /transcript/records/{record_id}/document` - Upload document (PDF, DOCX, image)
- `PUT /transcript/records/{record_id}/transcript` - Update transcript text

### AI Features
- `POST /transcript/records/{record_id}/summarize` - Generate summary
- `POST /transcript/records/{record_id}/generate-fields` - Extract structured fields
- `POST /transcript/records/{record_id}/query` - Query transcript with RAG

### Patient Search
- `GET /transcript/patients/{p_id}/records` - Get all records for a patient
- `POST /transcript/patients/{p_id}/query` - Query patient's transcripts

## 🔧 Technical Stack

### Backend
- **Framework**: FastAPI with async support
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Vector Database**: Qdrant (primary) + ChromaDB (fallback)
- **AI/ML**: 
  - OpenAI API (GPT models, Whisper, embeddings)
  - AssemblyAI (audio transcription)
  - LangChain (embeddings and vector stores)
- **File Processing**: 
  - PyMuPDF (PDF)
  - python-docx, docx2txt (Word documents)
  - Tesseract OCR (image text extraction)
  - Pillow (image processing)

### Frontend
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: Modern CSS/Tailwind CSS
- **HTTP Client**: Axios

## 📦 Key Dependencies

### Backend (`requirements.txt`)
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `sqlalchemy` - ORM
- `psycopg2-binary` - PostgreSQL adapter
- `openai` - OpenAI API client
- `langchain-openai` - LangChain OpenAI integrations
- `langchain-community` - LangChain community integrations
- `qdrant-client` - Qdrant vector database client
- `chromadb` - ChromaDB vector database
- `pymupdf` - PDF processing
- `pytesseract` - OCR
- `python-docx` - DOCX processing
- `pandas` - Data processing

### Frontend (`package.json`)
- `react` - UI library
- `typescript` - Type safety
- `vite` - Build tool
- `axios` - HTTP client

## 🔐 Security & Authentication

- JWT-based authentication
- User-specific data isolation
- Role-based access control (e.g., `transcript_access` role)
- Secure file storage (local or S3)
- Environment variable configuration for sensitive data

## 📝 Environment Variables

See `backend/env.sample` for a complete list of environment variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `ASSEMBLYAI_API_KEY` - AssemblyAI API key (for transcription)
- `QDRANT_URL` - Qdrant server URL (optional)
- `SECRET_KEY` - JWT secret key

## 🚨 Common Issues & Solutions

### Backend
* **Database Connection Error**:
  * Verify `.env` credentials
  * Ensure PostgreSQL server is running
  * Check database exists and user has permissions

* **Transcription Fails**:
  * Verify AssemblyAI API key is set
  * Check OpenAI API key for fallback
  * Ensure audio file format is supported

* **OCR Not Working**:
  * Install tesseract-ocr: `sudo apt install tesseract-ocr` (Linux) or `brew install tesseract` (macOS)
  * Verify installation: `tesseract --version`
  * For Windows, ensure Tesseract is in PATH

* **Vector Database Error**:
  * Check Qdrant is running (if using): `curl http://localhost:6333/health`
  * Verify ChromaDB path is writable
  * Check embeddings are being generated correctly

### Frontend
* **API Connection Error**:
  * Verify backend server is running on correct port
  * Check CORS settings in backend
  * Verify API base URL in `src/services/api.ts`

* **Build Errors**:
  * Clear node_modules and reinstall: `rm -rf node_modules && npm install`
  * Check Node.js version: `node --version` (should be 16+)

## 📚 Additional Documentation

- `CORE_FEATURES_README.md` - Detailed feature documentation
- `backend/docs/` - Backend-specific documentation
- API Documentation: http://localhost:8000/docs (when server is running)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

[Add your license information here]

## 💡 Notes

* Keep `.env` configurations secure and never commit them
* Regularly update dependencies for security patches
* Use production-ready settings for deployment
* Monitor API usage for OpenAI and AssemblyAI to manage costs
* Consider implementing rate limiting for production use
