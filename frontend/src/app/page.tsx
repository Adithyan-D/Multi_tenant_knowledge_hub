'use client';

import React, { useState, useEffect } from 'react';
import { HeaderBar } from '@/components/TenantSwitcher';
import { LoginScreen } from '@/components/LoginScreen';
import { DocumentManager } from '@/components/DocumentManager';
import { ChatWorkspace } from '@/components/ChatWorkspace';
import { CitationDrawer } from '@/components/CitationDrawer';
import { UserPersona, ChunkCitation } from '@/lib/types';
import { ShieldCheck, Info } from 'lucide-react';

const STORAGE_KEY = 'rag_active_user_persona';

export default function DashboardPage() {
  const [activePersona, setActivePersona] = useState<UserPersona | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<ChunkCitation | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Restore persisted session from localStorage on mount
  useEffect(() => {
    try {
      const savedPersona = localStorage.getItem(STORAGE_KEY);
      if (savedPersona) {
        setActivePersona(JSON.parse(savedPersona));
      }
    } catch (err) {
      console.warn('Failed to restore session from localStorage:', err);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const handleLogin = (persona: UserPersona) => {
    setActivePersona(persona);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persona));
    } catch (err) {
      console.warn('Failed to save session to localStorage:', err);
    }
  };

  const handleSignOut = () => {
    setActivePersona(null);
    setSelectedCitation(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear session from localStorage:', err);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-sky-500 rounded-full animate-ping" />
          <span>Initializing security session...</span>
        </div>
      </div>
    );
  }

  if (!activePersona) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header Profile & Sign Out Bar */}
      <HeaderBar
        activePersona={activePersona}
        onSignOut={handleSignOut}
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
