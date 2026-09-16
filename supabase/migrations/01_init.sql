-- Enable necessary extensions
create extension if not exists "vector";
create extension if not exists "pgcrypto";

-- 1. Organizations Table
create table if not exists public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz not null default now()
);

-- 2. Profiles Table (extending auth.users)
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    organization_id uuid references public.organizations(id) on delete cascade,
    role text not null check (role in ('admin', 'manager', 'member')),
    created_at timestamptz not null default now()
);

-- 3. Documents Table
create table if not exists public.documents (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    uploaded_by uuid references auth.users(id) on delete set null,
    title text not null,
    created_at timestamptz not null default now()
);

-- 4. Document Chunks Table
create table if not exists public.document_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.documents(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    content text not null,
    chunk_index integer not null,
    access_tier text not null check (access_tier in ('public', 'internal', 'confidential')),
    embedding vector(384),
    fts tsvector generated always as (to_tsvector('english', content)) stored
);

-- 5. Indexes
-- HNSW Index for vector cosine similarity
create index if not exists document_chunks_embedding_hnsw_idx 
    on public.document_chunks using hnsw (embedding vector_cosine_ops);

-- GIN Index for full-text search
create index if not exists document_chunks_fts_gin_idx 
    on public.document_chunks using gin (fts);

-- Secondary Indexes for foreign keys & filtering
create index if not exists document_chunks_org_id_idx on public.document_chunks(organization_id);
create index if not exists document_chunks_doc_id_idx on public.document_chunks(document_id);
create index if not exists documents_org_id_idx on public.documents(organization_id);

-- 6. Row-Level Security (RLS)

-- Enable RLS on all tables
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

-- Helper function to get current user's org id
create or replace function public.get_auth_user_org_id()
returns uuid
language sql
security definer
stable
as $$
    select organization_id from public.profiles where id = auth.uid() limit 1;
$$;

-- Helper function to get current user's role
create or replace function public.get_auth_user_role()
returns text
language sql
security definer
stable
as $$
    select role from public.profiles where id = auth.uid() limit 1;
$$;

-- RLS Policies for Profiles
create policy "Users can view profiles in their organization"
    on public.profiles for select
    using (organization_id = public.get_auth_user_org_id());

create policy "Users can update their own profile"
    on public.profiles for update
    using (id = auth.uid());

-- RLS Policies for Organizations
create policy "Users can view their organization"
    on public.organizations for select
    using (id = public.get_auth_user_org_id());

-- RLS Policies for Documents
create policy "Users can view documents in their organization"
    on public.documents for select
    using (organization_id = public.get_auth_user_org_id());

create policy "Users can insert documents into their organization"
    on public.documents for insert
    with check (organization_id = public.get_auth_user_org_id());

create policy "Users can delete documents in their organization"
    on public.documents for delete
    using (organization_id = public.get_auth_user_org_id());

-- RLS Policies for Document Chunks (Strict Access Control)
create policy "Document chunks select policy by org and clearance tier"
    on public.document_chunks for select
    using (
        organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid())
        and (
            access_tier = 'public'
            or (access_tier = 'internal' and (select p.role from public.profiles p where p.id = auth.uid()) in ('member', 'manager', 'admin'))
            or (access_tier = 'confidential' and (select p.role from public.profiles p where p.id = auth.uid()) in ('manager', 'admin'))
        )
    );

create policy "Users can insert document chunks into their organization"
    on public.document_chunks for insert
    with check (organization_id = public.get_auth_user_org_id());

create policy "Users can delete document chunks in their organization"
    on public.document_chunks for delete
    using (organization_id = public.get_auth_user_org_id());


-- 7. Hybrid Search RPC Function with Reciprocal Rank Fusion (RRF)
create or replace function public.hybrid_search_chunks(
    query_text text,
    query_embedding vector(384),
    match_count int default 5,
    rrf_k int default 60
)
returns table (
    id uuid,
    document_id uuid,
    organization_id uuid,
    content text,
    chunk_index int,
    access_tier text,
    document_title text,
    similarity float,
    fts_rank float,
    rrf_score float
)
language plpgsql
security invoker -- Runs with caller privileges, enforcing RLS on document_chunks automatically!
as $$
begin
    return query
    with full_text_search as (
        select 
            dc.id as chunk_id,
            ts_rank_cd(dc.fts, websearch_to_tsquery('english', query_text)) as score,
            row_number() over (order by ts_rank_cd(dc.fts, websearch_to_tsquery('english', query_text)) desc) as rank
        from public.document_chunks dc
        where query_text is not null and query_text != '' and dc.fts @@ websearch_to_tsquery('english', query_text)
        limit match_count * 3
    ),
    vector_search as (
        select 
            dc.id as chunk_id,
            (1 - (dc.embedding <=> query_embedding)) as score,
            row_number() over (order by (dc.embedding <=> query_embedding) asc) as rank
        from public.document_chunks dc
        where query_embedding is not null
        limit match_count * 3
    ),
    fused_scores as (
        select 
            coalesce(fts.chunk_id, vec.chunk_id) as chunk_id,
            coalesce(vec.score, 0.0)::float as similarity,
            coalesce(fts.score, 0.0)::float as fts_rank,
            (
                coalesce(1.0 / (rrf_k + fts.rank), 0.0) +
                coalesce(1.0 / (rrf_k + vec.rank), 0.0)
            )::float as rrf_score
        from full_text_search fts
        full outer join vector_search vec on fts.chunk_id = vec.chunk_id
    )
    select 
        dc.id,
        dc.document_id,
        dc.organization_id,
        dc.content,
        dc.chunk_index,
        dc.access_tier,
        d.title as document_title,
        fs.similarity,
        fs.fts_rank,
        fs.rrf_score
    from fused_scores fs
    join public.document_chunks dc on dc.id = fs.chunk_id
    join public.documents d on d.id = dc.document_id
    order by fs.rrf_score desc
    limit match_count;
end;
$$;
