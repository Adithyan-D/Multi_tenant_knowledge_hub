from typing import List, Dict, Any, AsyncGenerator
from groq import Groq
from app.config import settings

GROUNDED_SYSTEM_PROMPT = """You are an enterprise knowledge assistant. Answer the user query using ONLY the provided numbered context chunks: [CHUNK-1], [CHUNK-2], etc. 
If the answer is not directly supported by the context, say: "I cannot find sufficient authorized information to answer this question." 
Every claim you make must include inline citations referencing the corresponding source chunk like [CHUNK-1] or [CHUNK-2]. 
Do not rely on external knowledge or make assumptions outside the provided context chunks."""

class RAGService:
    def __init__(self):
        self.client = None
        if settings.GROQ_API_KEY:
            try:
                self.client = Groq(api_key=settings.GROQ_API_KEY)
            except Exception as e:
                print(f"[RAGService] Groq client initialization warning: {e}")

    def format_context(self, chunks: List[Dict[str, Any]]) -> str:
        """Format retrieved chunks with [CHUNK-1], [CHUNK-2] markers for LLM context."""
        if not chunks:
            return "NO CONTEXT AVAILABLE."

        context_lines = []
        for idx, chunk in enumerate(chunks, 1):
            title = chunk.get("document_title", "Untitled Document")
            tier = chunk.get("access_tier", "public").upper()
            content = chunk.get("content", "").strip()
            context_lines.append(f"[CHUNK-{idx}] (Document: {title} | Tier: {tier}):\n{content}")

        return "\n\n".join(context_lines)

    async def generate_response_stream(
        self, query: str, chunks: List[Dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        """Generate streaming completion from Groq LLM using strict grounded context."""
        context_str = self.format_context(chunks)
        user_message = f"Context Chunks:\n{context_str}\n\nUser Question:\n{query}"

        if not self.client:
            # Fallback mock streaming response if GROQ_API_KEY is not set
            if not chunks:
                yield "I cannot find sufficient authorized information to answer this question."
                return
                
            mock_text = f"Based on the provided enterprise documentation [CHUNK-1], here is the authorized information regarding your request: {chunks[0].get('content', '')[:150]}... [CHUNK-1]"
            for word in mock_text.split(" "):
                yield word + " "
            return

        try:
            response = self.client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": GROUNDED_SYSTEM_PROMPT},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.1,
                max_tokens=1024,
                stream=True
            )

            for chunk in response:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            yield f"\n[Error generating LLM response: {str(e)}]"

rag_service = RAGService()
