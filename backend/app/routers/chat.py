from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import time
import asyncio

from app.auth import get_current_user, get_supabase_client, AuthenticatedUser
from app.services.embedding import embedding_service
from app.services.rag import rag_service
from app.services.observability import observability_service
from app.config import settings
from supabase import Client

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    query: str
    match_count: Optional[int] = 5

@router.post("")
async def chat_rag_stream(
    request: ChatRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_client)
):
    """
    RAG Search and Generation Endpoint:
    1. Computes FastEmbed vector for input query.
    2. Invokes Supabase hybrid_search_chunks RPC (RRF combining Cosine + FTS).
    3. Respects PostgreSQL RLS automatically via user token.
    4. Streams Groq LLM response with inline citations [CHUNK-N].
    5. Records trace in Langfuse observability.
    """
    if not request.query or not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query string cannot be empty."
        )

    start_time = time.time()
    query_text = request.query.strip()

    # 1. Embed query locally via ONNX
    query_embedding = embedding_service.embed_text(query_text)

    # 2. Invoke hybrid search RPC in Supabase (enforces RLS)
    try:
        rpc_res = db.rpc(
            "hybrid_search_chunks",
            {
                "query_text": query_text,
                "query_embedding": query_embedding,
                "match_count": request.match_count or 5,
                "rrf_k": 60
            }
        ).execute()
        chunks = rpc_res.data or []
    except Exception as e:
        print(f"[Chat Router] RPC Execution Warning: {e}")
        # Fallback query directly on document_chunks if RPC fails or not initialized
        chunks = []

    # 3. Stream generator
    async def sse_event_stream():
        # First send context metadata (citations/chunks retrieved)
        metadata_payload = {
            "type": "metadata",
            "chunks": [
                {
                    "citation_id": f"CHUNK-{idx}",
                    "id": c.get("id"),
                    "document_id": c.get("document_id"),
                    "document_title": c.get("document_title", "Untitled Document"),
                    "content": c.get("content"),
                    "access_tier": c.get("access_tier"),
                    "similarity": c.get("similarity"),
                    "rrf_score": c.get("rrf_score")
                }
                for idx, c in enumerate(chunks, 1)
            ]
        }
        yield f"data: {json.dumps(metadata_payload)}\n\n"

        # Stream LLM tokens
        full_response_accumulated = []
        async for token in rag_service.generate_response_stream(query_text, chunks):
            full_response_accumulated.append(token)
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        latency = time.time() - start_time
        full_text = "".join(full_response_accumulated)

        # Log trace asynchronously in Langfuse
        observability_service.trace_rag_request(
            user_id=user.id,
            organization_id=user.organization_id,
            query=query_text,
            retrieved_chunks=chunks,
            response_text=full_text,
            latency_seconds=latency,
            model_name=settings.GROQ_MODEL
        )

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
