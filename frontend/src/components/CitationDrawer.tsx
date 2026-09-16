'use client';

import React from 'react';
import { ChunkCitation } from '@/lib/types';
import { X, FileText, Lock, ShieldCheck, Sparkles, Copy, Check } from 'lucide-react';

interface Props {
  citation: ChunkCitation | null;
  onClose: () => void;
}

export const CitationDrawer: React.FC<Props> = ({ citation, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!citation) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(citation.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let tierBadgeColor = 'bg-slate-100 text-slate-700 border-slate-300';
  if (citation.access_tier === 'public') tierBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-300';
  if (citation.access_tier === 'internal') tierBadgeColor = 'bg-amber-50 text-amber-700 border-amber-300';
  if (citation.access_tier === 'confidential') tierBadgeColor = 'bg-rose-50 text-rose-700 border-rose-300';

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
        <div className="flex items-center gap-2">
          <span className="bg-sky-500 text-slate-950 font-bold px-2 py-0.5 rounded text-xs">
            {citation.citation_id}
          </span>
          <h2 className="text-sm font-semibold text-white truncate max-w-[240px]">
            Citation Source Details
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        {/* Document Title Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Document Title</p>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">{citation.document_title}</h3>
            </div>
          </div>
        </div>

        {/* Security Tier & RRF Score Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              Clearance Tier
            </p>
            <div className="mt-1.5">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border uppercase font-mono ${tierBadgeColor}`}>
                {citation.access_tier}
              </span>
            </div>
          </div>

          <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Retrieval Score
            </p>
            <p className="text-xs font-bold font-mono text-slate-800 mt-1">
              {citation.rrf_score ? `RRF: ${citation.rrf_score.toFixed(4)}` : citation.similarity ? `Cosine: ${citation.similarity.toFixed(4)}` : 'RRF Ranked'}
            </p>
          </div>
        </div>

        {/* Chunk Content */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Exact Chunk Text Context
            </label>
            <button
              onClick={handleCopy}
              className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1 font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Text'}
            </button>
          </div>
          <div className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono leading-relaxed border border-slate-800 whitespace-pre-wrap">
            {citation.content}
          </div>
        </div>

        {/* Security Audit Badge */}
        <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2.5 text-xs text-sky-900">
          <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <p>
            This chunk was authorized and fetched via Postgres Row-Level Security (RLS) policies matching your active user role and tenant context.
          </p>
        </div>
      </div>
    </div>
  );
};
