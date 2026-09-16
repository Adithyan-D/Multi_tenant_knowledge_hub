from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import documents, chat
from app.config import settings

app = FastAPI(
    title="Multi-Tenant Enterprise RAG API",
    description="Production-grade, zero-cost multi-tenant RAG system with database-level RLS, FastEmbed ONNX embeddings, Groq LLM streaming, and Langfuse observability.",
    version="1.0.0"
)

# Enable CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(documents.router)
app.include_router(chat.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Multi-Tenant Enterprise RAG API",
        "version": "1.0.0",
        "embedding_model": "BAAI/bge-small-en-v1.5 (FastEmbed ONNX 384d)",
        "llm_model": settings.GROQ_MODEL
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}
