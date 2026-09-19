from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from typing import List, Optional
import io
from pypdf import PdfReader

from app.auth import get_current_user, get_supabase_client, get_service_role_supabase_client, AuthenticatedUser
from app.services.chunking import chunk_text
from app.services.embedding import embedding_service
from supabase import Client

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    access_tier: str = Form("public"),
    user: AuthenticatedUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_client)
):
    """
    Ingests text, markdown, or PDF files.
    Extracts text, splits into chunks, computes ONNX embeddings, and stores in PostgreSQL.
    """
    if access_tier not in ["public", "internal", "confidential"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid access_tier. Must be one of: public, internal, confidential"
        )

    # 1. Read file content and extract text
    filename = file.filename or "untitled.txt"
    content_bytes = await file.read()
    
    extracted_text = ""
    if filename.endswith(".pdf"):
        try:
            pdf_file = io.BytesIO(content_bytes)
            reader = PdfReader(pdf_file)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n\n"
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse PDF document: {str(e)}"
            )
    else:
        try:
            extracted_text = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            extracted_text = content_bytes.decode("latin-1", errors="ignore")

    if not extracted_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document text is empty or could not be extracted."
        )

    admin_db = get_service_role_supabase_client()

    # Get user's org id if not attached to user token
    org_id = user.organization_id
    if not org_id:
        try:
            profile_res = admin_db.table("profiles").select("organization_id").eq("id", user.id).execute()
            if profile_res.data:
                org_id = profile_res.data[0].get("organization_id")
        except Exception as e:
            print(f"[Documents Router] Warning fetching profile org: {e}")

    if not org_id:
        org_id = "11111111-1111-1111-1111-111111111111" # Default to Acme Corp in dev mode

    # Ensure organization exists in organizations table to satisfy foreign key constraint
    try:
        org_name = "Acme Corp" if org_id == "11111111-1111-1111-1111-111111111111" else "Globex Inc" if org_id == "22222222-2222-2222-2222-222222222222" else "Enterprise Org"
        admin_db.table("organizations").upsert({"id": org_id, "name": org_name}).execute()
    except Exception as e:
        print(f"[Documents Router] Warning upserting organization: {e}")

    # Check if uploaded_by user_id exists in auth.users table
    valid_user_id = None
    if user.id and len(user.id) == 36 and "-" in user.id:
        try:
            user_check = admin_db.table("profiles").select("id").eq("id", user.id).execute()
            if user_check.data:
                valid_user_id = user.id
        except Exception:
            valid_user_id = None

    try:
        # 2. Insert parent Document record
        doc_data = {
            "title": filename,
            "organization_id": org_id
        }
        if valid_user_id:
            doc_data["uploaded_by"] = valid_user_id

        doc_res = admin_db.table("documents").insert(doc_data).execute()

        if not doc_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create document record."
            )

        doc_id = doc_res.data[0]["id"]

        # 3. Chunk text
        chunks = chunk_text(extracted_text, target_tokens=400, overlap_tokens=50)
        chunk_texts = [c.content for c in chunks]

        # 4. Generate embeddings locally via ONNX FastEmbed
        embeddings = embedding_service.embed_documents(chunk_texts)

        # 5. Batch insert chunks
        chunk_records = []
        for c, emb in zip(chunks, embeddings):
            chunk_records.append({
                "document_id": doc_id,
                "organization_id": org_id,
                "content": c.content,
                "chunk_index": c.chunk_index,
                "access_tier": access_tier,
                "embedding": emb
            })

        if chunk_records:
            admin_db.table("document_chunks").insert(chunk_records).execute()

        return {
            "status": "success",
            "document_id": doc_id,
            "title": filename,
            "access_tier": access_tier,
            "total_chunks": len(chunk_records)
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting document: {str(e)}"
        )

@router.get("")
async def list_documents(
    user: AuthenticatedUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_client)
):
    """
    Returns list of uploaded documents visible to user's organization.
    """
    admin_db = get_service_role_supabase_client()
    org_id = user.organization_id or "11111111-1111-1111-1111-111111111111"

    try:
        res = admin_db.table("documents").select("id, title, access_tier:document_chunks(access_tier), created_at").eq("organization_id", org_id).execute()
        
        # Process documents and aggregate clearance tiers
        documents = []
        for doc in (res.data or []):
            chunks_info = doc.get("access_tier", [])
            tiers = set(c.get("access_tier") for c in chunks_info if isinstance(c, dict)) if chunks_info else {"public"}
            documents.append({
                "id": doc["id"],
                "title": doc["title"],
                "created_at": doc["created_at"],
                "access_tiers": list(tiers),
                "chunk_count": len(chunks_info) if chunks_info else 0
            })

        return {"documents": documents}
    except Exception as e:
        print(f"[Documents Router] Warning fetching documents list: {e}")
        return {"documents": []}
