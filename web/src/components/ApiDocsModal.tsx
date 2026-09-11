'use client';

import React, { useState } from 'react';
import { X, Terminal, Copy, Check, ShieldCheck, Zap, Layers, Activity } from 'lucide-react';

interface ApiDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

export function ApiDocsModal({ isOpen, onClose, initialTab = 'endpoints' }: ApiDocsModalProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const curlPresign = `curl -X POST http://127.0.0.1:8085/v1/uploads/presign \\
  -H "Content-Type: application/json" \\
  -d '{"filename": "document.pdf", "file_size": 1048576}'`;

  const curlCreateJob = `curl -X POST http://127.0.0.1:8085/v1/jobs \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: job_req_998231" \\
  -d '{
    "upload_id": "880ffa22-c673-4ec1-8301-391cb07d542c",
    "operation": "pdf_compress",
    "parameters": {"compression_tier": "recommended"}
  }'`;

  const curlBatch = `curl -X POST http://127.0.0.1:8085/v1/jobs/batch \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      {"upload_id": "up_1", "operation": "pdf_compress"},
      {"upload_id": "up_2", "operation": "pdf_ocr"},
      {"upload_id": "up_3", "operation": "png_to_webp"}
    ]
  }'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E5322D] flex items-center justify-center text-white">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Developer REST API & System Architecture</h2>
              <p className="text-xs text-slate-500">Production-grade asynchronous job pipeline with multi-queue dispatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-2 pt-2">
          {[
            { id: 'endpoints', label: 'REST Endpoints' },
            { id: 'presign', label: 'Direct Storage Upload' },
            { id: 'batch', label: 'Batch Processing (/batch)' },
            { id: 'metrics', label: 'Observability & Metrics' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-[#E5322D] text-[#E5322D]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 flex-1">
          {activeTab === 'endpoints' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    POST /v1/uploads/presign
                  </span>
                  <span className="text-xs text-slate-400">Request signed direct upload URL</span>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl text-xs font-mono overflow-x-auto relative">
                  <code>{curlPresign}</code>
                  <button
                    onClick={() => copyToClipboard(curlPresign, 'presign')}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                  >
                    {copiedId === 'presign' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </pre>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    POST /v1/jobs
                  </span>
                  <span className="text-xs text-slate-400">Dispatch job with Idempotency Key</span>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl text-xs font-mono overflow-x-auto relative">
                  <code>{curlCreateJob}</code>
                  <button
                    onClick={() => copyToClipboard(curlCreateJob, 'job')}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                  >
                    {copiedId === 'job' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'presign' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900">Direct-to-Storage Streaming Architecture</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Files are never buffered in memory on the API gateway. The gateway issues a cryptographically signed upload slot, allowing the client browser or worker to stream the binary payload directly into storage with zero gateway bottleneck.
              </p>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                <strong>Idempotency Guarantee:</strong> All job dispatch requests support the <code>Idempotency-Key</code> header to prevent duplicate execution across retries and transient network interruptions.
              </div>
            </div>
          )}

          {activeTab === 'batch' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900">Atomic Multi-Queue Batch Processing</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The <code>/v1/jobs/batch</code> endpoint allows submitting multiple heterogeneous files in a single atomic transaction. Jobs are dynamically routed to isolated queues:
              </p>
              <ul className="text-xs list-disc pl-5 space-y-1 text-slate-600">
                <li><code>queue_pdf_heavy</code>: High-DPI QPDF stream linearization</li>
                <li><code>queue_office</code>: Headless LibreOffice conversion sandbox</li>
                <li><code>queue_ocr</code>: Tesseract 5 OCR text layer synthesis</li>
                <li><code>queue_image_fast</code>: Catmull-Rom image resampling and WebP conversion</li>
              </ul>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl text-xs font-mono overflow-x-auto relative">
                <code>{curlBatch}</code>
                <button
                  onClick={() => copyToClipboard(curlBatch, 'batch')}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                >
                  {copiedId === 'batch' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </pre>
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900">Native Prometheus Metrics Scraper</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Our backend exposes live operational metrics on <code>/metrics</code> for Prometheus, Grafana, and Datadog scrapers:
              </p>
              <div className="space-y-2 font-mono text-xs bg-slate-900 text-slate-200 p-4 rounded-2xl">
                <div># TYPE lipdf_jobs_total counter</div>
                <div>lipdf_jobs_total&#123;operation="pdf_compress",status="completed"&#125; 14</div>
                <div className="mt-2"># TYPE lipdf_job_duration_seconds gauge</div>
                <div>lipdf_job_duration_seconds&#123;operation="pdf_ocr"&#125; 0.8111</div>
                <div className="mt-2"># TYPE lipdf_active_jobs gauge</div>
                <div>lipdf_active_jobs&#123;queue="queue_pdf_std"&#125; 0</div>
              </div>
              <div className="flex gap-3">
                <a
                  href="/metrics"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Open Live /metrics</span>
                </a>
                <a
                  href="/readyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Open Live /readyz</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  );
}
