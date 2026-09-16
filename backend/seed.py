"""
Seed Script for Multi-Tenant Enterprise RAG System.
Populates test organizations, test profiles, and sample documents with FastEmbed embeddings.
"""
import os
import uuid
import sys
from supabase import create_client

# Add parent directory to python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.services.embedding import embedding_service
from app.services.chunking import chunk_text

# Fixed UUIDs for predictable testing across multi-tenancy roles
ORG_ACME_ID = "11111111-1111-1111-1111-111111111111"
ORG_GLOBEX_ID = "22222222-2222-2222-2222-222222222222"

USER_ADMIN_ID = "aaaaaa11-1111-1111-1111-111111111111"
USER_MANAGER_ID = "bbbbbb22-2222-2222-2222-222222222222"
USER_MEMBER_ID = "cccccc33-3333-3333-3333-333333333333"
USER_GLOBEX_ID = "dddddd44-4444-4444-4444-444444444444"

SAMPLE_DOCUMENTS = [
    {
        "title": "Acme Employee Handbook 2026.md",
        "org_id": ORG_ACME_ID,
        "uploaded_by": USER_ADMIN_ID,
        "access_tier": "public",
        "content": """# Acme Corp Employee Handbook 2026

## Office Hours & Remote Work
Acme Corp standard core working hours are 9:00 AM to 5:00 PM EST. 
Employees are eligible for hybrid remote work on Mondays and Fridays. 
All team members must log presence in Slack during core hours.

## Wellness & Benefits
Acme Corp provides 100% employer-covered health insurance, dental coverage, and a $500 annual wellness stipend usable for gym memberships and ergonomic home office setups."""
    },
    {
        "title": "Acme Internal Product Roadmap Q3-Q4.md",
        "org_id": ORG_ACME_ID,
        "uploaded_by": USER_MANAGER_ID,
        "access_tier": "internal",
        "content": """# Acme Corp Internal Product Roadmap Q3-Q4 2026

## Project Apollo (AI Knowledge Engine)
Project Apollo target launch date is September 30, 2026. 
The system integrates Supabase vector search, Groq LLMs, and real-time document chunking.
Target ARR contribution: $2.5M by end of fiscal year.

## Infrastructure Upgrades
Migration of all API services to containerized Kubernetes clusters on Render/Railway for zero downtime deployments."""
    },
    {
        "title": "Acme M&A Financial Valuation (CONFIDENTIAL).md",
        "org_id": ORG_ACME_ID,
        "uploaded_by": USER_ADMIN_ID,
        "access_tier": "confidential",
        "content": """# CONFIDENTIAL: Acme Corp Acquisition Valuation & Terms

## BetaTech Acquisition Details
Acme Corp executive leadership has initiated formal non-binding acquisition negotiations for BetaTech Inc.
Estimated acquisition purchase price: $50,000,000 in cash and stock options.
Closing Target: Q4 2026 subject to SEC regulatory clearance.

## Revenue & Profit Projections
Post-merger projected revenue for combined entities is $120M with EBITDA margins exceeding 32%."""
    },
    {
        "title": "Globex Strategy Document.md",
        "org_id": ORG_GLOBEX_ID,
        "uploaded_by": USER_GLOBEX_ID,
        "access_tier": "confidential",
        "content": """# Globex Inc Competitor Analysis & Strategy

## Acme Corp Competition
Globex Inc plans to expand into Acme's core markets by pricing enterprise subscriptions 30% below Acme list prices.
Target enterprise accounts: Cyberdyne Systems and Massive Dynamic."""
    }
]

def run_seed():
    print("Starting Multi-Tenant RAG Database Seeding...")
    
    supabase_url = settings.SUPABASE_URL
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY

    if not supabase_url or "your-project" in supabase_url or "your-anon-key" in (service_key or ""):
        print("\n[ERROR] Placeholder Supabase credentials detected!")
        print("Please replace SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file with your actual Supabase project credentials.")
        print("Get them from: Supabase Dashboard -> Project Settings -> API")
        return

    try:
        db = create_client(supabase_url, service_key)

        # 1. Seed Organizations
        orgs = [
            {"id": ORG_ACME_ID, "name": "Acme Corp"},
            {"id": ORG_GLOBEX_ID, "name": "Globex Inc"}
        ]
        for org in orgs:
            try:
                db.table("organizations").upsert(org).execute()
                print(f"✓ Organization seeded: {org['name']}")
            except Exception as e:
                print(f"Organization seed warning for {org['name']}: {e}")

        # 2. Seed Profiles
        profiles = [
            {"id": USER_ADMIN_ID, "organization_id": ORG_ACME_ID, "role": "admin"},
            {"id": USER_MANAGER_ID, "organization_id": ORG_ACME_ID, "role": "manager"},
            {"id": USER_MEMBER_ID, "organization_id": ORG_ACME_ID, "role": "member"},
            {"id": USER_GLOBEX_ID, "organization_id": ORG_GLOBEX_ID, "role": "admin"}
        ]
        for p in profiles:
            try:
                db.table("profiles").upsert(p).execute()
                print(f"✓ Profile seeded: User {p['id'][:8]} (Role: {p['role']})")
            except Exception as e:
                print(f"Profile seed warning: {e}")

        # 3. Seed Sample Documents & Compute ONNX Embeddings
        print("\nComputing FastEmbed embeddings for sample document chunks...")
        for doc_data in SAMPLE_DOCUMENTS:
            try:
                doc_res = db.table("documents").insert({
                    "title": doc_data["title"],
                    "organization_id": doc_data["org_id"],
                    "uploaded_by": doc_data["uploaded_by"]
                }).execute()
                
                doc_id = doc_res.data[0]["id"]
                
                chunks = chunk_text(doc_data["content"])
                chunk_texts = [c.content for c in chunks]
                embeddings = embedding_service.embed_documents(chunk_texts)

                chunk_records = []
                for c, emb in zip(chunks, embeddings):
                    chunk_records.append({
                        "document_id": doc_id,
                        "organization_id": doc_data["org_id"],
                        "content": c.content,
                        "chunk_index": c.chunk_index,
                        "access_tier": doc_data["access_tier"],
                        "embedding": emb
                    })

                db.table("document_chunks").insert(chunk_records).execute()
                print(f"✓ Document ingested: {doc_data['title']} ({len(chunk_records)} chunks, Tier: {doc_data['access_tier']})")
            except Exception as e:
                print(f"Document ingestion error for {doc_data['title']}: {e}")

        print("\nSeeding Completed Successfully!")

    except Exception as e:
        print(f"\n[Seed Script Note] Connected with error or offline mode: {e}")

if __name__ == "__main__":
    run_seed()
