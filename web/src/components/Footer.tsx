'use client';

import React from 'react';
import {
  FileText,
  ShieldCheck,
  Lock,
  Globe,
  Smartphone,
  Monitor,
  Terminal,
  Zap,
  CheckCircle2,
  ChevronDown,
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
              <span>ISO 27001 Aligned</span>
            </span>
            <span className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-xs">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Deterministic Output Validator</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main 5-Column Navigation Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Column 1: Product */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Product
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
                  Optimize & Compress
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

          {/* Column 2: Solutions */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Solutions
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#business" className="hover:text-[#E5322D] transition-colors">
                  Business & Enterprise
                </a>
              </li>
              <li>
                <a href="#education" className="hover:text-[#E5322D] transition-colors">
                  Education & Research
                </a>
              </li>
              <li>
                <a href="#developers" className="hover:text-[#E5322D] transition-colors">
                  Developers & API
                </a>
              </li>
              <li>
                <a href="#high-volume" className="hover:text-[#E5322D] transition-colors">
                  High-Volume Batching
                </a>
              </li>
              <li>
                <a href="#desktop" className="hover:text-[#E5322D] transition-colors">
                  Air-Gapped Offline Utility
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Resources
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#desktop-app" className="hover:text-[#E5322D] transition-colors flex items-center space-x-1.5">
                  <Monitor className="w-3.5 h-3.5 text-slate-400" />
                  <span>Desktop App</span>
                </a>
              </li>
              <li>
                <a href="#mobile-web" className="hover:text-[#E5322D] transition-colors flex items-center space-x-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mobile Web</span>
                </a>
              </li>
              <li>
                <a href="/api-docs" className="hover:text-[#E5322D] transition-colors flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <span>REST API & SDK</span>
                </a>
              </li>
              <li>
                <a href="#metrics" className="hover:text-[#E5322D] transition-colors">
                  Prometheus Metrics
                </a>
              </li>
              <li>
                <a href="#capabilities" className="hover:text-[#E5322D] transition-colors">
                  Capability Registry
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Security & Legal */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Security & Legal
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#security-policy" className="hover:text-[#E5322D] transition-colors">
                  Security Architecture
                </a>
              </li>
              <li>
                <a href="#privacy-policy" className="hover:text-[#E5322D] transition-colors">
                  Zero-Retention Policy
                </a>
              </li>
              <li>
                <a href="#ephemeral-purger" className="hover:text-[#E5322D] transition-colors">
                  1-Hour Ephemeral Purger
                </a>
              </li>
              <li>
                <a href="#terms" className="hover:text-[#E5322D] transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#validator-gate" className="hover:text-[#E5322D] transition-colors">
                  Output Validator Gate
                </a>
              </li>
            </ul>
          </div>

          {/* Column 5: Ecosystem & App Platforms */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Get the Apps
            </h3>
            <div className="space-y-2.5">
              <a
                href="#download-desktop"
                className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-800"
              >
                <Monitor className="w-4 h-4 text-[#E5322D]" />
                <div className="text-left">
                  <div className="text-[10px] text-slate-400 leading-none">Download for</div>
                  <div>Windows / macOS</div>
                </div>
              </a>

              <a
                href="#download-mobile"
                className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-800"
              >
                <Smartphone className="w-4 h-4 text-[#E5322D]" />
                <div className="text-left">
                  <div className="text-[10px] text-slate-400 leading-none">PWA Available on</div>
                  <div>iOS & Android</div>
                </div>
              </a>
            </div>

            <div className="mt-6">
              <div className="text-xs font-semibold text-slate-500 mb-2">Language</div>
              <button className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <span className="flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span>English (Global)</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
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
