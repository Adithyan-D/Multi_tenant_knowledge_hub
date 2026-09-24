"""
Persistent Dev Store Fallback for Document Chunks, Organizations, and Hybrid Search.
Used ONLY as an offline/local-fallback mock when Supabase credentials are missing or unreachable.
When Supabase is connected, PostgreSQL is treated as the sole source of truth.
"""

import os
import json
import uuid
import datetime
import math
from typing import List, Dict, Any, Optional

STORE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "dev_rag_store.json")

class PersistentDevStore:
    def __init__(self):
        self.documents: List[Dict[str, Any]] = []
        self.chunks: List[Dict[str, Any]] = []
        self.users: List[Dict[str, Any]] = []
        self.organizations: List[Dict[str, Any]] = []
        self.load_from_disk()

    def load_from_disk(self):
        if os.path.exists(STORE_FILE):
            try:
                with open(STORE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.documents = data.get("documents", [])
                    self.chunks = data.get("chunks", [])
                    self.users = data.get("users", [])
                    self.organizations = data.get("organizations", [])
            except Exception as e:
                print(f"[Dev Store] Warning loading store from disk: {e}")

    def save_to_disk(self):
        try:
            os.makedirs(os.path.dirname(STORE_FILE), exist_ok=True)
            data = {
                "documents": self.documents,
                "chunks": self.chunks,
                "users": self.users,
                "organizations": self.organizations
            }
            with open(STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[Dev Store] Warning saving store to disk: {e}")

    def add_document(self, title: str, organization_id: str, uploaded_by: Optional[str] = None) -> str:
        doc_id = str(uuid.uuid4())
        doc = {
            "id": doc_id,
            "title": title,
            "organization_id": organization_id,
            "uploaded_by": uploaded_by,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        self.documents.append(doc)
        self.save_to_disk()
        return doc_id

    def add_chunks(self, document_id: str, organization_id: str, title: str, chunks: List[Dict[str, Any]], access_tier: str):
        for c in chunks:
            chunk_record = {
                "id": str(uuid.uuid4()),
                "document_id": document_id,
                "organization_id": organization_id,
                "content": c["content"],
                "chunk_index": c["chunk_index"],
                "access_tier": access_tier,
                "document_title": title,
                "embedding": c.get("embedding", [])
            }
            self.chunks.append(chunk_record)
        self.save_to_disk()

    def delete_document(self, document_id: str, user_org_id: str, user_role: str) -> bool:
        # Check permission: Admins and Managers can delete
        if user_role not in ["admin", "manager"]:
            return False

        # Find document
        target_doc = next((d for d in self.documents if d["id"] == document_id), None)
        if not target_doc:
            return False

        # Check tenant organization ownership (unless admin)
        if user_role != "admin" and target_doc["organization_id"] != user_org_id:
            return False

        # Remove document and child chunks (cascading deletion)
        self.documents = [d for d in self.documents if d["id"] != document_id]
        self.chunks = [c for c in self.chunks if c["document_id"] != document_id]
        self.save_to_disk()
        return True

    def list_documents(self, user_org_id: str, user_role: str) -> List[Dict[str, Any]]:
        result = []
        for doc in self.documents:
            doc_chunks = [c for c in self.chunks if c["document_id"] == doc["id"]]
            tiers = set(c["access_tier"] for c in doc_chunks) if doc_chunks else {"public"}
            
            is_same_org = doc["organization_id"] == user_org_id
            is_public_doc = "public" in tiers

            if not is_public_doc and not is_same_org:
                continue

            if is_same_org and user_role == "member" and "confidential" in tiers and "public" not in tiers and "internal" not in tiers:
                continue

            result.append({
                "id": doc["id"],
                "title": doc["title"],
                "created_at": doc["created_at"],
                "access_tiers": list(tiers),
                "chunk_count": len(doc_chunks)
            })
        return result

    def search_chunks(self, query_text: str, query_embedding: List[float], user_org_id: str, user_role: str, limit: int = 5) -> List[Dict[str, Any]]:
        matching_chunks = []
        query_words = set(query_text.lower().split())

        for chunk in self.chunks:
            tier = chunk["access_tier"]
            is_same_org = chunk["organization_id"] == user_org_id

            if tier == "public":
                pass
            elif is_same_org and (
                (tier == "internal" and user_role in ["member", "manager", "admin"]) or
                (tier == "confidential" and user_role in ["manager", "admin"])
            ):
                pass
            else:
                continue

            content_words = set(chunk["content"].lower().split())
            overlap = len(query_words.intersection(content_words))

            sim = 0.5
            if query_embedding and chunk.get("embedding"):
                dot = sum(a * b for a, b in zip(query_embedding, chunk["embedding"]))
                norm_a = math.sqrt(sum(a * a for a in query_embedding))
                norm_b = math.sqrt(sum(b * b for b in chunk["embedding"]))
                if norm_a > 0 and norm_b > 0:
                    sim = dot / (norm_a * norm_b)

            score = sim + (0.1 * overlap)
            matching_chunks.append({
                "id": chunk["id"],
                "document_id": chunk["document_id"],
                "organization_id": chunk["organization_id"],
                "content": chunk["content"],
                "chunk_index": chunk["chunk_index"],
                "access_tier": tier,
                "document_title": chunk["document_title"],
                "similarity": sim,
                "rrf_score": score
            })

        matching_chunks.sort(key=lambda x: x["rrf_score"], reverse=True)
        return matching_chunks[:limit]

dev_store = PersistentDevStore()
