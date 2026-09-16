'use client';

import React from 'react';
import { UserPersona } from '@/lib/types';
import { ShieldCheck, Building2, UserCheck, ShieldAlert, Sparkles } from 'lucide-react';

export const MOCK_PERSONAS: UserPersona[] = [
  {
    id: 'aaaaaa11-1111-1111-1111-111111111111',
    name: 'Alice Admin',
    role: 'admin',
    organizationId: '11111111-1111-1111-1111-111111111111',
    organizationName: 'Acme Corp',
    email: 'alice@acmecorp.com',
  },
  {
    id: 'bbbbbb22-2222-2222-2222-222222222222',
    name: 'Bob Manager',
    role: 'manager',
    organizationId: '11111111-1111-1111-1111-111111111111',
    organizationName: 'Acme Corp',
    email: 'bob@acmecorp.com',
  },
  {
    id: 'cccccc33-3333-3333-3333-333333333333',
    name: 'Charlie Member',
    role: 'member',
    organizationId: '11111111-1111-1111-1111-111111111111',
    organizationName: 'Acme Corp',
    email: 'charlie@acmecorp.com',
  },
  {
    id: 'dddddd44-4444-4444-4444-444444444444',
    name: 'David Globex',
    role: 'admin',
    organizationId: '22222222-2222-2222-2222-222222222222',
    organizationName: 'Globex Inc',
    email: 'david@globex.com',
  },
];

interface Props {
  activePersona: UserPersona;
  onSelectPersona: (persona: UserPersona) => void;
}

export const TenantSwitcher: React.FC<Props> = ({ activePersona, onSelectPersona }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white px-6 py-3 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Title / Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-sky-500 p-2 rounded-lg text-slate-950 font-bold">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Multi-Tenant Enterprise RAG
              <span className="text-xs bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-mono border border-sky-500/30">
                Supabase RLS Enforced
              </span>
            </h1>
            <p className="text-xs text-slate-400">Database-Level Row Security • FastEmbed ONNX • Groq LLM • Langfuse</p>
          </div>
        </div>

        {/* Tenant & Role Switcher UI */}
        <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700 p-1.5 rounded-xl">
          <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-sky-400" />
            <span>RLS Context:</span>
          </div>

          <div className="flex items-center gap-1">
            {MOCK_PERSONAS.map((p) => {
              const isSelected = p.id === activePersona.id;
              let roleBadgeColor = 'bg-slate-700 text-slate-300';
              if (p.role === 'admin') roleBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
              if (p.role === 'manager') roleBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
              if (p.role === 'member') roleBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPersona(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-sky-600 text-white border-sky-400 shadow-sm font-semibold'
                      : 'bg-slate-900/50 text-slate-300 border-slate-700 hover:bg-slate-700/60'
                  }`}
                >
                  <UserCheck className="w-3 h-3" />
                  <span>{p.name}</span>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded border font-mono ${roleBadgeColor}`}>
                    {p.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
