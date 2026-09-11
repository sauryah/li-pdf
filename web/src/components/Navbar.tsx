import React from 'react';
import { ShieldCheck, FileText, Zap, Sparkles } from 'lucide-react';

export function Navbar() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight text-slate-900">
              li<span className="text-blue-600">.pdf</span>
            </span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              v2.1 Core
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600">
          <a href="#pdf-tools" className="hover:text-blue-600 transition-colors">PDF Tools</a>
          <a href="#image-tools" className="hover:text-blue-600 transition-colors">Image Utilities</a>
          <a href="#compression" className="hover:text-blue-600 transition-colors">Compression</a>
          <a href="#security" className="hover:text-blue-600 transition-colors">Privacy & Security</a>
        </nav>

        <div className="flex items-center space-x-3">
          <div className="flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            <span>1-Hour Auto Purge</span>
          </div>
        </div>
      </div>
    </header>
  );
}
