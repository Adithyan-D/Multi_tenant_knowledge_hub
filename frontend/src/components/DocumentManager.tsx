'use client';

import React, { useState, useEffect } from 'react';
import { UserPersona, DocumentItem, AccessTier } from '@/lib/types';
import { UploadCloud, FileText, Lock, ShieldAlert, CheckCircle2, RefreshCw, Layers } from 'lucide-react';

interface Props {
  activePersona: UserPersona;
}

export const DocumentManager: React.FC<Props> = ({ activePersona }) => {
  const [file, setFile] = useState<File | null>(null);
  const [accessTier, setAccessTier] = useState<AccessTier>('public');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  const fetchDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const res = await fetch('/api/backend/documents', {
        headers: {
          'X-Test-User-Id': activePersona.id,
          'X-Test-Role': activePersona.role,
          'X-Test-Org-Id': activePersona.organizationId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [activePersona]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('access_tier', accessTier);

    try {
      const res = await fetch('/api/backend/documents/upload', {
        method: 'POST',
        headers: {
          'X-Test-User-Id': activePersona.id,
          'X-Test-Role': activePersona.role,
          'X-Test-Org-Id': activePersona.organizationId,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadStatus(`Success! Ingested ${data.total_chunks} chunks as ${accessTier.toUpperCase()}`);
        setFile(null);
        fetchDocuments();
      } else {
        let errMessage = 'Server error';
        try {
          const err = await res.json();
          errMessage = err.detail || JSON.stringify(err);
        } catch {
          const text = await res.text();
          errMessage = text || `HTTP ${res.status}`;
        }
        setUploadStatus(`Upload failed: ${errMessage}`);
      }
    } catch (err: any) {
      setUploadStatus(`Network error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Card Header */}
      <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Document Management</h2>
            <p className="text-xs text-slate-500">Ingest text, markdown, or PDF files into vector store</p>
          </div>
        </div>
        <button
          onClick={fetchDocuments}
          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          title="Refresh Documents"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingDocs ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="p-5 space-y-4 border-b border-slate-100">
        {/* Dropzone */}
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-sky-400 transition-colors bg-slate-50/50">
          <input
            type="file"
            accept=".txt,.md,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            id="file-upload-input"
          />
          <label htmlFor="file-upload-input" className="cursor-pointer block space-y-2">
            <FileText className="w-8 h-8 text-sky-500 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">
              {file ? file.name : 'Click to upload or drag & drop (.txt, .md, .pdf)'}
            </p>
            {file && <p className="text-[11px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>}
          </label>
        </div>

        {/* Clearance Level Selector */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Security Clearance Tier
            </label>
            <select
              value={accessTier}
              onChange={(e) => setAccessTier(e.target.value as AccessTier)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="public">Public (All Organization Users)</option>
              <option value="internal">Internal (Member, Manager, Admin)</option>
              <option value="confidential">Confidential (Manager & Admin Only)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={!file || isUploading}
            className="mt-5 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {isUploading ? 'Chunking & Embedding...' : 'Upload & Embed'}
          </button>
        </div>

        {uploadStatus && (
          <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
            uploadStatus.startsWith('Success') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {uploadStatus.startsWith('Success') ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
            {uploadStatus}
          </div>
        )}
      </form>

      {/* Documents Table */}
      <div className="flex-1 overflow-y-auto p-5">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          Ingested Documents ({documents.length})
        </h3>

        {documents.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
            <p className="text-xs text-slate-400">No documents uploaded yet for this organization context.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-3 border border-slate-100 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-800 truncate">{doc.title}</p>
                    <p className="text-[10px] text-slate-400">{new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded font-mono">
                    {doc.chunk_count ? `${doc.chunk_count} ${doc.chunk_count === 1 ? 'chunk' : 'chunks'}` : 'ingested'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
