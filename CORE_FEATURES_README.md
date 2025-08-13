# 🤖 Advanced RAG-Powered Chatbot Platform

**A comprehensive, production-ready chatbot solution with dynamic model selection, intelligent chunking, and advanced RAG capabilities.**

## 🚀 Core Features

### **Multi-Model Architecture**
Our chatbot supports a flexible, pluggable model architecture that allows seamless switching between different LLM and embedding models without code changes.

#### **Current LLM Model**
- **OpenAI Model**: gpt-4o-mini
- **Dynamic Model Selection**: Models can be changed per bot or globally via database configuration

#### **Current Embedding Model**
- **OpenAI Embeddings**: text-embedding-3-small
- **Multi-Provider Support**: Seamless switching between OpenAI and HuggingFace Models

### **Dynamic Chunking System**
Our intelligent text chunking system adapts to different content types and model requirements:

#### **Configurable Chunk Parameters**
- **Default Chunk Size**: 1000 tokens (configurable per bot)
- **Default Chunk Overlap**: 100 tokens (configurable per bot)

#### **Chunking Features**
- **Token-Aware**: Uses tiktoken for accurate token counting
- **Model-Specific**: Adjusts chunking based on model's max input tokens
- **Fallback Protection**: Returns original text as single chunk if chunking fails
- **Logging**: Comprehensive logging of chunking operations for debugging

### **Advanced Vector Search Algorithm**

#### **Multi-Vector Database Support**
- **Primary**: Qdrant (with scalar quantization for 4x memory efficiency)
- **Fallback**: ChromaDB for compatibility
- **Unified Collection**: Single collection with metadata filtering for isolation

#### **Search Algorithm Details**
- **Cosine Similarity**: Normalized embeddings for consistent similarity scoring
- **Metadata Filtering**: Bot and user isolation through metadata filters
- **Top-K Retrieval**: Configurable number of results (default: 5)
- **Score Calculation**: Converts cosine distance to similarity score (0-1)

#### **Search Process**
1. **Query Embedding**: Generate embedding for user query
2. **Vector Normalization**: Normalize query embedding for consistent comparison
3. **Metadata Filtering**: Apply bot_id, user_id, and model filters
4. **Similarity Search**: Find most similar documents using cosine similarity
5. **Score Conversion**: Convert distances to similarity scores
6. **Result Ranking**: Return top-k most relevant documents

### **RAG (Retrieval-Augmented Generation) Implementation**

#### **Context Preparation**
- **Document Retrieval**: Fetches relevant documents from vector database
- **Context Concatenation**: Combines retrieved documents into single context
- **Length Management**: Handles context length limits based on model capabilities

#### **Prompt Engineering**
The system uses sophisticated prompt templates that adapt based on knowledge settings:

**Strict Context Mode** (Default):
```
You are a helpful assistant. Only answer based on the provided context. 
If the context doesn't have relevant information, respond with exactly: "[unanswered_message]". 
Do not use external knowledge under any circumstances.

Context: [retrieved_documents]

User: [user_message]
```

**External Knowledge Mode**:
```
You are a helpful assistant. Answer based on the provided context, but you can use your general knowledge if needed.

Context: [retrieved_documents]

User: [user_message]
```

#### **Response Generation Features**
- **Temperature Control**: Configurable creativity (default: 0.7)
- **Length Limiting**: Responses limited to 15 short, clear sentences
- **Language Detection**: Automatic language detection for multi-language support
- **Chat History**: Maintains conversation context across interactions

### **Model Selection Hierarchy**

The system implements a sophisticated model selection hierarchy:

1. **Bot-Specific Models** (Highest Priority)
   - Individual bots can have dedicated LLM and embedding models
   - Allows fine-tuned performance per use case

2. **Subscription Plan Models** (Medium Priority)
   - Default models based on user's subscription plan
   - Different plans can have different model capabilities

3. **System-Wide Defaults** (Lowest Priority)
   - Fallback to first active model of each type
   - Ensures system always has working models

### **Knowledge Base Management**

#### **Supported Content Types**
- **Documents**: PDF, DOCX, TXT, and other text formats
- **YouTube Videos**: Automatic transcript extraction using Apify API
- **Websites**: Intelligent web scraping with Playwright


### **Asynchronous Processing System**

#### **Task Management**
- **Celery**: Distributed task queue
- **Redis**: Message broker and caching
- **Flower**: Task monitoring dashboard
- **Notifications**: User notifications on task completion

### **Advanced Features**

#### **Multi-Language Support**
- **Language Detection**: Automatic detection using lingua library
- **Localized Responses**: Context-aware language handling

#### **Analytics and Monitoring**
- **Conversation Tracking**: Complete chat history and analytics
- **Performance Metrics**: Response times, accuracy tracking
- **Usage Analytics**: Word counts, message counts, file sizes
- **AI Logging**: Detailed logging of AI operations for debugging

#### **Security and Isolation**
- **User Isolation**: Complete data separation between users
- **Bot Isolation**: Individual bot knowledge bases
- **API Key Management**: Secure handling of multiple API keys

#### **Customization Options**
- **UI Customization**: Colors, fonts, positioning
- **Response Customization**: Temperature, max words, unanswered messages
- **Lead Generation**: Configurable lead capture forms

## 🔧 Technical Architecture

### **Backend Stack**
- **Framework**: FastAPI with async support
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Vector Database**: Qdrant (primary) + ChromaDB (fallback)
- **Task Queue**: Celery with Redis
- **File Storage**: Local + S3 support

### **Frontend Stack**
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: Modern CSS with customization support

### **AI/ML Stack**
- **Embeddings**: OpenAI + HuggingFace APIs
- **LLMs**: OpenAI + HuggingFace Inference API
- **Text Processing**: LangChain, tiktoken, sentence-transformers
- **Chunking**: LangChain text splitters