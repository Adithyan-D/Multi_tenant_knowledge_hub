# Production Dockerfile for FastAPI + FastEmbed ONNX RAG Backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for build and ONNX runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download and cache FastEmbed ONNX model weights (BAAI/bge-small-en-v1.5)
RUN python -c "from fastembed import TextEmbedding; list(TextEmbedding(model_name='BAAI/bge-small-en-v1.5').embed(['warmup']))"

# Copy backend source code
COPY . .

# Expose port
EXPOSE 8000

# Command to launch FastAPI with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
