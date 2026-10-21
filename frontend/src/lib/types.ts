export type AccessTier = 'public' | 'internal' | 'confidential';
export type UserRole = 'admin' | 'manager' | 'member';

export interface UserPersona {
  id: string;
  name: string;
  role: UserRole;
  designation?: string;
  organizationId: string;
  organizationName: string;
  email: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  organization_id?: string;
  created_at: string;
  access_tiers?: AccessTier[];
  chunk_count?: number;
}

export interface ChunkCitation {
  citation_id: string; // e.g. "CHUNK-1"
  id: string;
  document_id: string;
  document_title: string;
  content: string;
  access_tier: AccessTier;
  similarity?: number;
  rrf_score?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: ChunkCitation[];
  isStreaming?: boolean;
}
