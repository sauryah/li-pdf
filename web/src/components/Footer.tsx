'use client';

import React from 'react';
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

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 mt-20">
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
                1-Hour Ephemeral Auto-Purge • Sandboxed Execution • Zero Data Retention
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
                <a href="/" className="hover:text-[#E5322D] transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="#organize" className="hover:text-[#E5322D] transition-colors">
                  Organize PDF
                </a>
              </li>
              <li>
                <a href="#optimize" className="hover:text-[#E5322D] transition-colors">
                  Compress & Optimize
                </a>
              </li>
              <li>
                <a href="#convert-to-pdf" className="hover:text-[#E5322D] transition-colors">
                  Convert to PDF
                </a>
              </li>
              <li>
                <a href="#convert-from-pdf" className="hover:text-[#E5322D] transition-colors">
                  Convert from PDF
                </a>
              </li>
              <li>
                <a href="#workflow-automation" className="hover:text-[#E5322D] transition-colors">
                  Workflow Builder
                </a>
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
                <a href="#batch-processing" className="hover:text-[#E5322D] transition-colors flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Multi-Queue Batching</span>
                </a>
              </li>
              <li>
                <a href="#ocr-engine" className="hover:text-[#E5322D] transition-colors">
                  Tesseract 5 OCR Engine
                </a>
              </li>
              <li>
                <a href="#qpdf-engine" className="hover:text-[#E5322D] transition-colors">
                  QPDF Linearizer & Crypto
                </a>
              </li>
              <li>
                <a href="#libreoffice-engine" className="hover:text-[#E5322D] transition-colors">
                  Headless LibreOffice
                </a>
              </li>
              <li>
                <a href="#image-engine" className="hover:text-[#E5322D] transition-colors">
                  Catmull-Rom Image Scaler
                </a>
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
                <a href="#api-endpoints" className="hover:text-[#E5322D] transition-colors flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <span>REST API Endpoints</span>
                </a>
              </li>
              <li>
                <a href="#metrics" className="hover:text-[#E5322D] transition-colors flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  <span>Prometheus Metrics (/metrics)</span>
                </a>
              </li>
              <li>
                <a href="#readiness" className="hover:text-[#E5322D] transition-colors">
                  Health & Readiness (/readyz)
                </a>
              </li>
              <li>
                <a href="#direct-upload" className="hover:text-[#E5322D] transition-colors">
                  Direct Presigned Uploads
                </a>
              </li>
              <li>
                <a href="#idempotency" className="hover:text-[#E5322D] transition-colors">
                  Idempotency Guarantee
                </a>
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
                <a href="#security-policy" className="hover:text-[#E5322D] transition-colors">
                  Hostile Sandbox Isolation
                </a>
              </li>
              <li>
                <a href="#privacy-policy" className="hover:text-[#E5322D] transition-colors">
                  Zero Data Retention
                </a>
              </li>
              <li>
                <a href="#ephemeral-purger" className="hover:text-[#E5322D] transition-colors">
                  1-Hour Ephemeral Purger
                </a>
              </li>
              <li>
                <a href="#validator-gate" className="hover:text-[#E5322D] transition-colors">
                  Output Validator Gate
                </a>
              </li>
              <li>
                <a href="#aes256" className="hover:text-[#E5322D] transition-colors">
                  AES-256 PDF Encryption
                </a>
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
