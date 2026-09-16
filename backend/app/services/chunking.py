import re
from typing import List, Dict, Any

class Chunk:
    def __init__(self, content: str, chunk_index: int, token_count: int):
        self.content = content
        self.chunk_index = chunk_index
        self.token_count = token_count

def estimate_tokens(text: str) -> int:
    """Rough estimation of token count (~4 characters per token)."""
    return max(1, len(text) // 4)

def chunk_text(text: str, target_tokens: int = 400, overlap_tokens: int = 50) -> List[Chunk]:
    """
    Semantic and paragraph-aware text chunker.
    Splits text into ~400 token chunks with ~50 token overlap.
    Preserves markdown headings and paragraph boundaries where possible.
    """
    if not text or not text.strip():
        return []

    # Clean text line breaks
    cleaned_text = re.sub(r'\r\n', '\n', text.strip())
    
    # Split text into paragraphs based on double newlines or markdown headers
    paragraphs = re.split(r'\n\s*\n', cleaned_text)
    
    chunks: List[Chunk] = []
    current_paragraphs: List[str] = []
    current_tokens = 0
    chunk_index = 0

    target_chars = target_tokens * 4
    overlap_chars = overlap_tokens * 4

    for p in paragraphs:
        p_str = p.strip()
        if not p_str:
            continue
            
        p_tokens = estimate_tokens(p_str)
        
        # If single paragraph exceeds target chunk size, split by sentences/lines
        if p_tokens > target_tokens * 1.5:
            sentences = re.split(r'(?<=[.!?])\s+', p_str)
            for s in sentences:
                s_tokens = estimate_tokens(s)
                if current_tokens + s_tokens > target_tokens and current_paragraphs:
                    chunk_content = "\n\n".join(current_paragraphs)
                    chunks.append(Chunk(
                        content=chunk_content,
                        chunk_index=chunk_index,
                        token_count=estimate_tokens(chunk_content)
                    ))
                    chunk_index += 1
                    
                    # Create overlap from end of previous text
                    overlap_text = chunk_content[-overlap_chars:] if len(chunk_content) > overlap_chars else chunk_content
                    current_paragraphs = [overlap_text, s]
                    current_tokens = estimate_tokens(overlap_text) + s_tokens
                else:
                    current_paragraphs.append(s)
                    current_tokens += s_tokens
        else:
            if current_tokens + p_tokens > target_tokens and current_paragraphs:
                chunk_content = "\n\n".join(current_paragraphs)
                chunks.append(Chunk(
                    content=chunk_content,
                    chunk_index=chunk_index,
                    token_count=estimate_tokens(chunk_content)
                ))
                chunk_index += 1
                
                # Overlap logic
                overlap_text = chunk_content[-overlap_chars:] if len(chunk_content) > overlap_chars else chunk_content
                current_paragraphs = [overlap_text, p_str]
                current_tokens = estimate_tokens(overlap_text) + p_tokens
            else:
                current_paragraphs.append(p_str)
                current_tokens += p_tokens

    # Append final chunk if non-empty
    if current_paragraphs:
        chunk_content = "\n\n".join(current_paragraphs)
        chunks.append(Chunk(
            content=chunk_content,
            chunk_index=chunk_index,
            token_count=estimate_tokens(chunk_content)
        ))

    return chunks
