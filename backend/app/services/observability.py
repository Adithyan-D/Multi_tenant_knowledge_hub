from typing import Optional, Dict, Any, List
import time
from app.config import settings

class ObservabilityService:
    def __init__(self):
        self.client = None
        if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
            try:
                from langfuse import Langfuse
                self.client = Langfuse(
                    public_key=settings.LANGFUSE_PUBLIC_KEY,
                    secret_key=settings.LANGFUSE_SECRET_KEY,
                    host=settings.LANGFUSE_HOST
                )
            except Exception as e:
                print(f"[Observability] Warning: Failed to initialize Langfuse: {e}")
                self.client = None

    def trace_rag_request(
        self,
        user_id: str,
        organization_id: Optional[str],
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        response_text: str,
        latency_seconds: float,
        model_name: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0
    ):
        """Log full RAG request trace to Langfuse if configured."""
        if not self.client:
            print(f"[Observability Mock Trace] User: {user_id}, Org: {organization_id}, Chunks: {len(retrieved_chunks)}, Latency: {latency_seconds:.2f}s")
            return

        try:
            if hasattr(self.client, "trace"):
                trace = self.client.trace(
                    name="rag-query",
                    user_id=user_id,
                    metadata={
                        "organization_id": organization_id,
                        "model_name": model_name,
                        "retrieved_chunk_count": len(retrieved_chunks)
                    },
                    input={"query": query}
                )

                # Record Retrieval Span
                trace.span(
                    name="retrieval-hybrid-rrf",
                    input={"query": query},
                    output={"chunks": [
                        {
                            "id": c.get("id"),
                            "document_title": c.get("document_title"),
                            "access_tier": c.get("access_tier"),
                            "rrf_score": c.get("rrf_score"),
                            "similarity": c.get("similarity")
                        } for c in retrieved_chunks
                    ]}
                )

                # Record Generation Event
                trace.generation(
                    name="llm-generation",
                    model=model_name,
                    input=query,
                    output=response_text,
                    usage={
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "total_tokens": prompt_tokens + completion_tokens
                    },
                    latency=latency_seconds
                )

                self.client.flush()
        except Exception as e:
            print(f"[Observability Warning] Skipping Langfuse trace: {e}")

observability_service = ObservabilityService()
