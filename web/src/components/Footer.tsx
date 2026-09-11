'use client';

import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Lock,
  Terminal,
  Zap,
  CheckCircle2,
  Activity,
  Layers,
} from 'lucide-react';
import { ApiDocsModal } from './ApiDocsModal';

export function Footer() {
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [apiModalTab, setApiModalTab] = useState('endpoints');

  const handleSelectTool = (operation: string, accepts: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('lipdf:select_tool', {
          detail: { operation, accepts },
        })
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectCategory = (category: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('lipdf:select_category', {
          detail: { category },
        })
      );
      const catalogEl = document.getElementById('capabilities-catalog');
      if (catalogEl) {
        catalogEl.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 300, behavior: 'smooth' });
      }
    }
  };

  const openApiModal = (tab: string = 'endpoints') => {
    setApiModalTab(tab);
    setApiModalOpen(true);
  };

  const scrollToSection = (id: string) => {
    if (typeof window !== 'undefined') {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 mt-20">
      {/* API Documentation Interactive Modal */}
      <ApiDocsModal
        isOpen={apiModalOpen}
        onClose={() => setApiModalOpen(false)}
        initialTab={apiModalTab}
      />

      {/* Trust & Certifications Banner */}
      <div className="border-b border-slate-100 bg-slate-50/70 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-[#E5322D] flex items-center justify-center text-white font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Enterprise-Grade Privacy & Security
              </div>
              <div className="text-xs text-slate-500">
                Sandboxed Execution • TLS 1.3 Encryption • Zero Data Retention
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-xs">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>TLS 1.3 / AES-256</span>
            </span>
            <span className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Output Validator Gate</span>
            </span>
            <span className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-xs">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Deterministic Quality</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main 4-Column Navigation Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Column 1: Core Document Tools */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Document Tools
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => {
                    handleSelectCategory('all');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Home & Upload
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelectCategory('organize')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Organize PDF
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelectCategory('optimize')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Compress & Optimize
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelectCategory('convert_to')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Convert to PDF
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelectCategory('convert_from')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Convert from PDF
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('workflow-automation')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Workflow Builder
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Engine Architecture */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Engine Architecture
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => scrollToSection('workflow-automation')}
                  className="hover:text-[#E5322D] transition-colors flex items-center space-x-1.5 text-left"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Multi-Queue Batching</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelectTool('pdf_ocr', '.pdf')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Tesseract 5 OCR Engine
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelectTool('pdf_compress', '.pdf')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  QPDF Linearizer & Crypto
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelectTool('docx_to_pdf', '.docx,.doc')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Headless LibreOffice
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelectTool('image_resize', '.jpg,.jpeg,.png,.webp')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Catmull-Rom Image Scaler
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Developer & API Resources */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Developer & Observability
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => openApiModal('endpoints')}
                  className="hover:text-[#E5322D] transition-colors flex items-center space-x-1.5 text-left"
                >
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <span>REST API Endpoints</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => openApiModal('metrics')}
                  className="hover:text-[#E5322D] transition-colors flex items-center space-x-1.5 text-left"
                >
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  <span>Prometheus Metrics (/metrics)</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => openApiModal('metrics')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Health & Readiness (/readyz)
                </button>
              </li>
              <li>
                <button
                  onClick={() => openApiModal('presign')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Direct Presigned Uploads
                </button>
              </li>
              <li>
                <button
                  onClick={() => openApiModal('presign')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Idempotency Guarantee
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Security & Ephemeral Lifecycle */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Security & Privacy
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => scrollToSection('architecture-pillars')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Hostile Sandbox Isolation
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('architecture-pillars')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Zero Data Retention
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('faq')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Privacy FAQ
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('architecture-pillars')}
                  className="hover:text-[#E5322D] transition-colors text-left"
                >
                  Output Validator Gate
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelectTool('pdf_encrypt', '.pdf')}
                  className="hover:text-[#E5322D] transition-colors text-left font-semibold text-[#E5322D]"
                >
                  Protect PDF (AES-256)
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Legal & Copyright Bar */}
      <div className="border-t border-slate-200 py-6 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded-lg bg-[#E5322D] flex items-center justify-center text-white font-bold text-xs">
              li
            </div>
            <span className="font-bold text-slate-800">li.pdf</span>
            <span>— Universal Document & Image Platform</span>
          </div>

          <div>
            © 2026 <strong>li.pdf</strong> ®. All rights reserved. Zero telemetry & Ephemeral storage.
          </div>
        </div>
      </div>
    </footer>
  );
}
