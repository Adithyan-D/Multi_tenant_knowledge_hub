from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from typing import List, Optional
import io
from pypdf import PdfReader

from app.auth import get_current_user, get_supabase_client, get_service_role_supabase_client, AuthenticatedUser
from app.services.chunking import chunk_text
from app.services.embedding import embedding_service
from app.services.store import dev_store
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
    if user.role == "member":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Document upload is restricted to Organization Managers and Admins."
        )

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

    # Chunk text & compute ONNX FastEmbed embeddings
    chunks = chunk_text(extracted_text, target_tokens=400, overlap_tokens=50)
    chunk_texts = [c.content for c in chunks]
    embeddings = embedding_service.embed_documents(chunk_texts)

    # Prepare chunk list for dev store or Supabase
    chunk_objs = [{"content": c.content, "chunk_index": c.chunk_index, "embedding": emb} for c, emb in zip(chunks, embeddings)]

    try:
        # Try database insertion in Supabase
        doc_data = {
            "title": filename,
            "organization_id": org_id
        }
        if valid_user_id:
            doc_data["uploaded_by"] = valid_user_id

        doc_res = admin_db.table("documents").insert(doc_data).execute()
        if doc_res.data:
            doc_id = doc_res.data[0]["id"]
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

            # Also sync to dev_store as backup
            dev_store.add_chunks(doc_id, org_id, filename, chunk_objs, access_tier)

            return {
                "status": "success",
                "document_id": doc_id,
                "title": filename,
                "access_tier": access_tier,
                "total_chunks": len(chunk_records)
            }
    except Exception as db_err:
        print(f"[Documents Router] Supabase DB connection offline/placeholder ({db_err}), using Dev Store fallback.")

    # Fallback to dev store if Supabase is offline or placeholder credentials used
    doc_id = dev_store.add_document(filename, org_id, user.id)
    dev_store.add_chunks(doc_id, org_id, filename, chunk_objs, access_tier)

    return {
        "status": "success",
        "document_id": doc_id,
        "title": filename,
        "access_tier": access_tier,
        "total_chunks": len(chunk_objs)
    }

@router.get("")
async def list_documents(
    user: AuthenticatedUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_client)
):
    """
    Returns list of uploaded documents visible to user's organization and authorized clearance level.
    """
    admin_db = get_service_role_supabase_client()
    org_id = user.organization_id or "11111111-1111-1111-1111-111111111111"
    user_role = user.role or "member"

    try:
        res = admin_db.table("documents").select("id, organization_id, title, access_tier:document_chunks(access_tier), created_at").execute()
        
        documents = []
        for doc in (res.data or []):
            doc_org_id = doc.get("organization_id")
            chunks_info = doc.get("access_tier", [])
            tiers = set(c.get("access_tier") for c in chunks_info if isinstance(c, dict)) if chunks_info else {"public"}
            
            is_same_org = doc_org_id == org_id
            is_public_doc = "public" in tiers

            if not is_public_doc and not is_same_org:
                continue

            if is_same_org and user_role == "member" and "confidential" in tiers and "public" not in tiers and "internal" not in tiers:
                continue

            documents.append({
                "id": doc["id"],
                "title": doc["title"],
                "organization_id": doc_org_id,
                "created_at": doc["created_at"],
                "access_tiers": list(tiers),
                "chunk_count": len(chunks_info) if chunks_info else 0
            })

        # Merge with dev store documents if present
        dev_docs = dev_store.list_documents(org_id, user_role)
        existing_ids = set(d["id"] for d in documents)
        for dd in dev_docs:
            if dd["id"] not in existing_ids:
                documents.append(dd)

        return {"documents": documents}
    except Exception as e:
        print(f"[Documents Router] Supabase unreachable ({e}), using Dev Store list fallback.")
        dev_docs = dev_store.list_documents(org_id, user_role)
        return {"documents": dev_docs}

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_client)
):
    """
    Deletes a document and its child chunks. Restricted strictly to Managers and Admins of the uploading organization.
    """
    if user.role not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Document deletion is restricted to Organization Managers and Admins."
        )

    admin_db = get_service_role_supabase_client()
    org_id = user.organization_id or "11111111-1111-1111-1111-111111111111"
    user_role = user.role or "member"

    # 1. Fetch document organization ownership
    doc_org_id = None
    try:
        doc_res = admin_db.table("documents").select("organization_id").eq("id", document_id).execute()
        if doc_res.data:
            doc_org_id = doc_res.data[0].get("organization_id")
    except Exception as e:
        print(f"[Documents Router] Warning fetching document org for delete: {e}")

    # Fallback check in dev_store if not found in Supabase
    if not doc_org_id:
        target_dev_doc = next((d for d in dev_store.documents if d["id"] == document_id), None)
        if target_dev_doc:
            doc_org_id = target_dev_doc.get("organization_id")

    if not doc_org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    # 2. Strict Tenant Deletion Ownership Check
    if doc_org_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only delete documents uploaded by your own organization."
        )

    deleted_in_supabase = False
    try:
        # Delete child chunks first to guarantee zero foreign key violations
        admin_db.table("document_chunks").delete().eq("document_id", document_id).execute()
        del_res = admin_db.table("documents").delete().eq("id", document_id).execute()
        if del_res.data:
            deleted_in_supabase = True
    except Exception as e:
        print(f"[Documents Router] Supabase deletion notice ({e}), proceeding with fallback.")

    deleted_in_dev_store = dev_store.delete_document(document_id, org_id, user_role)

    if not deleted_in_supabase and not deleted_in_dev_store:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to delete document."
        )

    return {"status": "success", "message": f"Document {document_id} permanently deleted."}
