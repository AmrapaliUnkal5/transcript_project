# 🤖 Chatbot
**Optimised Pluggable Chatbot Solution**

## Project Structure

This project is a comprehensive chatbot application divided into two core components:

- **Frontend**: React TypeScript application built with Vite
- **Backend**: FastAPI-powered API service

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
- Python 3.8+
- pip
- Virtual environment support

#### Installation Steps

1. Navigate to backend directory
```bash
cd backend
```

2. Create virtual environment
```bash
python3 -m venv venv
```

3. Activate virtual environment
- **macOS/Linux**: `source venv/bin/activate`
- **Windows**: `venv\Scripts\activate`

4. Install dependencies
```bash
pip install -r requirements.txt
```

5. Configure Environment
Create a `.env` file with:
```
GOOGLE_CLIENT_ID=your-google-client-id
DATABASE_URL=postgresql://username:password@localhost/dbname
```

6. Run Backend Server
```bash
uvicorn app.main:app --reload
```

#### Troubleshooting
- **Import Error**: Ensure you're in the backend directory
- **Module Not Found**: Verify PYTHONPATH and project structure

### Frontend Setup

#### Prerequisites
- Node.js 16+
- npm

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
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000

## 🛠 Common Issues & Solutions

### Backend
- **Database Connection**:
  - Verify `.env` credentials
  - Ensure database server is running

### Frontend
- **API Data Fetching**:
  - Check backend server URL configuration
- **CORS Errors**:
  - Add CORS middleware to FastAPI

## 💡 Final Recommendations
- Keep `.env` configurations secure
- Use Node.js 16+
- Regularly update dependencies