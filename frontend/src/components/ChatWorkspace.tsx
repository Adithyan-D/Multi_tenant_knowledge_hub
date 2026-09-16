'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UserPersona, ChatMessage, ChunkCitation } from '@/lib/types';
import { Send, Bot, User, Sparkles, AlertCircle, Bookmark } from 'lucide-react';

interface Props {
  activePersona: UserPersona;
  onSelectCitation: (citation: ChunkCitation) => void;
}

export const ChatWorkspace: React.FC<Props> = ({ activePersona, onSelectCitation }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Hello! I am your enterprise knowledge assistant. Ask me anything about your organization documents. My responses are strictly grounded and enforced by Supabase database-level Row-Level Security (RLS).',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isGenerating) return;

    const userText = inputQuery.trim();
    setInputQuery('');

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;

    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: userText,
    };

    const initialAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      text: '',
      citations: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/backend/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Test-User-Id': activePersona.id,
          'X-Test-Role': activePersona.role,
          'X-Test-Org-Id': activePersona.organizationId,
        },
        body: JSON.stringify({ query: userText, match_count: 5 }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let citations: ChunkCitation[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.replace(/^data: /, '').trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'metadata') {
                citations = event.chunks || [];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, citations } : m
                  )
                );
              } else if (event.type === 'token') {
                accumulatedText += event.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, text: accumulatedText }
                      : m
                  )
                );
              }
            } catch (err) {
              console.warn('Failed to parse SSE event:', jsonStr);
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, isStreaming: false } : m
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: `Sorry, an error occurred while generating the response: ${err.message}`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Render text with interactive citation pills [CHUNK-N]
  const renderMessageTextWithCitations = (text: string, citations?: ChunkCitation[]) => {
    if (!text) return null;

    const citationRegex = /\[CHUNK-(\d+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      const matchText = match[0]; // e.g. "[CHUNK-1]"
      const chunkIndex = parseInt(match[1], 10);
      const startIndex = match.index;

      if (startIndex > lastIndex) {
        parts.push(text.substring(lastIndex, startIndex));
      }

      const citationObj = citations?.find(
        (c) => c.citation_id === `CHUNK-${chunkIndex}`
      );

      parts.push(
        <button
          key={`cit-${startIndex}`}
          onClick={() => {
            if (citationObj) {
              onSelectCitation(citationObj);
            }
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md bg-sky-100 hover:bg-sky-200 border border-sky-300 text-sky-800 font-bold text-xs font-mono transition-colors"
          title={citationObj ? `Source: ${citationObj.document_title}` : 'Citation details'}
        >
          <Bookmark className="w-3 h-3 text-sky-600" />
          {matchText}
        </button>
      );

      lastIndex = citationRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return <div className="whitespace-pre-wrap leading-relaxed">{parts}</div>;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Grounded RAG Chat Workspace</h2>
            <p className="text-xs text-slate-500">Query enterprise data with inline citation verification</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-200/50 px-3 py-1.5 rounded-lg border border-slate-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Active Context: {activePersona.name} ({activePersona.role.toUpperCase()})</span>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xs ${
                  isUser ? 'bg-sky-600' : 'bg-slate-900'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Content */}
              <div className="space-y-2">
                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm ${
                    isUser
                      ? 'bg-sky-600 text-white rounded-tr-none'
                      : 'bg-slate-100 text-slate-900 border border-slate-200/80 rounded-tl-none'
                  }`}
                >
                  {isUser
                    ? msg.text
                    : renderMessageTextWithCitations(msg.text, msg.citations)}
                  {msg.isStreaming && !msg.text && (
                    <div className="flex items-center gap-1.5 text-slate-400 py-1">
                      <span className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
                      <span className="w-2 h-2 bg-sky-500 rounded-full animate-pulse delay-150" />
                      <span className="w-2 h-2 bg-sky-500 rounded-full animate-pulse delay-300" />
                    </div>
                  )}
                </div>

                {/* Citations Preview pills below message */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 mr-1">Retrieved Sources:</span>
                    {msg.citations.map((c) => (
                      <button
                        key={c.citation_id}
                        onClick={() => onSelectCitation(c)}
                        className="text-[11px] bg-white border border-slate-200 hover:border-sky-400 px-2 py-0.5 rounded shadow-2xs font-mono text-slate-700 flex items-center gap-1 transition-colors"
                      >
                        <span className="text-sky-600 font-bold">{c.citation_id}</span>
                        <span className="text-slate-500 truncate max-w-[120px]">{c.document_title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder={`Ask a question as ${activePersona.name} (${activePersona.role})...`}
          disabled={isGenerating}
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isGenerating}
          className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-xs sm:text-sm flex items-center gap-2 shadow-sm"
        >
          <span>Send</span>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
