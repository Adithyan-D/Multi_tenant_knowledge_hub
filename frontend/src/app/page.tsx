'use client';

import React, { useState } from 'react';
import { TenantSwitcher, MOCK_PERSONAS } from '@/components/TenantSwitcher';
import { DocumentManager } from '@/components/DocumentManager';
import { ChatWorkspace } from '@/components/ChatWorkspace';
import { CitationDrawer } from '@/components/CitationDrawer';
import { UserPersona, ChunkCitation } from '@/lib/types';
import { ShieldCheck, Info } from 'lucide-react';

export default function DashboardPage() {
  const [activePersona, setActivePersona] = useState<UserPersona>(MOCK_PERSONAS[0]);
  const [selectedCitation, setSelectedCitation] = useState<ChunkCitation | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header Tenant / Role Switcher */}
      <TenantSwitcher
        activePersona={activePersona}
        onSelectPersona={(persona) => {
          setActivePersona(persona);
          setSelectedCitation(null);
        }}
      />

      {/* Security Context Banner */}
      <div className="bg-sky-900 text-sky-100 text-xs py-2 px-6 border-b border-sky-800 flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              Active RLS Context: <strong>{activePersona.name}</strong> ({activePersona.role.toUpperCase()}) @ <strong>{activePersona.organizationName}</strong>. 
              {activePersona.role === 'member' && ' Confidential document chunks are strictly blocked by PostgreSQL RLS.'}
              {activePersona.role !== 'member' && ' Authorized to access Public, Internal, and Confidential clearance tiers.'}
            </span>
          </div>
          <span className="font-mono text-[11px] bg-sky-950 px-2 py-0.5 rounded border border-sky-700 text-sky-300">
            Tenant ID: {activePersona.organizationId.slice(0, 8)}...
          </span>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-110px)]">
        {/* Left Column: Document Ingestion & Management */}
        <div className="lg:col-span-4 h-full">
          <DocumentManager activePersona={activePersona} />
        </div>

        {/* Right Column: Grounded RAG Chat Workspace */}
        <div className="lg:col-span-8 h-full">
          <ChatWorkspace
            activePersona={activePersona}
            onSelectCitation={(citation) => setSelectedCitation(citation)}
          />
        </div>
      </main>

      {/* Interactive Citation Drawer */}
      <CitationDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
}
