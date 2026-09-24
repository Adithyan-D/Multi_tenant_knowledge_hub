'use client';

import React from 'react';
import { UserPersona } from '@/lib/types';
import { ShieldCheck, Building2, User, LogOut, Sparkles } from 'lucide-react';

interface Props {
  activePersona: UserPersona;
  onSignOut: () => void;
}

export const HeaderBar: React.FC<Props> = ({ activePersona, onSignOut }) => {
  let roleBadgeColor = 'bg-slate-700 text-slate-300 border-slate-600';
  if (activePersona.role === 'admin') roleBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  if (activePersona.role === 'manager') roleBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  if (activePersona.role === 'member') roleBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white px-6 py-3 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Title / Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-sky-500 p-2 rounded-xl text-slate-950 font-bold shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Multi-Tenant Knowledge Hub
              <span className="text-xs bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-mono border border-sky-500/30">
                Supabase RLS Active
              </span>
            </h1>
            <p className="text-xs text-slate-400">Database-Level Row Security • FastEmbed ONNX • Groq LLM</p>
          </div>
        </div>

        {/* Authenticated User Profile & Sign Out */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700 px-3.5 py-1.5 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <User className="w-4 h-4" />
            </div>

            <div className="text-left leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{activePersona.name}</span>
                <span className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded border ${roleBadgeColor}`}>
                  {activePersona.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {activePersona.designation || activePersona.role} @ <strong className="text-slate-300">{activePersona.organizationName}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-900/40 hover:text-rose-300 border border-slate-700 hover:border-rose-700/50 text-xs font-semibold text-slate-300 transition-all shadow-2xs"
            title="Sign out of your session"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};

// Export TenantSwitcher alias for backwards compatibility
export const TenantSwitcher = HeaderBar;
