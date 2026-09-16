import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Multi-Tenant Enterprise RAG | Row-Level Security',
  description: 'Production-grade zero-cost enterprise RAG system with Supabase PostgreSQL RLS and local ONNX embeddings.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
