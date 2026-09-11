'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  FileText,
  ChevronDown,
  Minimize2,
  Image as ImageIcon,
  RotateCw,
  FileSpreadsheet,
  FileCode,
  Lock,
  FileCheck2,
  Layers,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';

interface NavbarProps {
  onSelectTool?: (operation: string, accepts: string) => void;
  onSelectCategory?: (category: string) => void;
}

export function Navbar({ onSelectTool, onSelectCategory }: NavbarProps) {
  const [convertDropdownOpen, setConvertDropdownOpen] = useState(false);
  const [allToolsDropdownOpen, setAllToolsDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const convertRef = useRef<HTMLDivElement>(null);
  const allToolsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (convertRef.current && !convertRef.current.contains(event.target as Node)) {
        setConvertDropdownOpen(false);
      }
      if (allToolsRef.current && !allToolsRef.current.contains(event.target as Node)) {
        setAllToolsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToolClick = (operation: string, accepts: string) => {
    setConvertDropdownOpen(false);
    setAllToolsDropdownOpen(false);
    setMobileMenuOpen(false);
    if (onSelectTool) {
      onSelectTool(operation, accepts);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('lipdf:select_tool', {
          detail: { operation, accepts },
        })
      );
    }
  };

  const handleCategoryClick = (category: string, href?: string) => {
    setConvertDropdownOpen(false);
    setAllToolsDropdownOpen(false);
    setMobileMenuOpen(false);
    if (onSelectCategory) {
      onSelectCategory(category);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('lipdf:select_category', {
          detail: { category },
        })
      );
    }
    if (href && typeof window !== 'undefined') {
      window.location.hash = href;
    }
  };

  return (
    <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="/" className="flex items-center space-x-2.5 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-md shadow-red-500/20 group-hover:scale-105 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex items-center">
            <span className="font-extrabold text-2xl tracking-tight text-slate-900">
              li<span className="text-red-600">.pdf</span>
            </span>
          </div>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-1 text-sm font-semibold text-slate-700">
          <button
            onClick={() => handleToolClick('pdf_compress', '.pdf')}
            className="px-3.5 py-2 rounded-lg hover:text-red-600 hover:bg-red-50/60 transition-colors"
          >
            Compress PDF
          </button>
          <button
            onClick={() => handleToolClick('pdf_to_docx', '.pdf')}
            className="px-3.5 py-2 rounded-lg hover:text-red-600 hover:bg-red-50/60 transition-colors"
          >
            PDF to Word
          </button>
          <button
            onClick={() => handleToolClick('docx_to_pdf', '.docx,.doc')}
            className="px-3.5 py-2 rounded-lg hover:text-red-600 hover:bg-red-50/60 transition-colors"
          >
            Word to PDF
          </button>
          <button
            onClick={() => handleToolClick('pdf_ocr', '.pdf')}
            className="px-3.5 py-2 rounded-lg hover:text-red-600 hover:bg-red-50/60 transition-colors"
          >
            OCR PDF
          </button>

          {/* Convert PDF Dropdown */}
          <div className="relative" ref={convertRef}>
            <button
              onClick={() => {
                setConvertDropdownOpen(!convertDropdownOpen);
                setAllToolsDropdownOpen(false);
              }}
              className="flex items-center space-x-1 px-3.5 py-2 rounded-lg hover:text-red-600 hover:bg-red-50/60 transition-colors"
            >
              <span>Convert PDF</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${convertDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {convertDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-[480px] bg-white rounded-2xl shadow-xl border border-slate-100 p-5 grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Convert to PDF
                  </div>
                  <div className="space-y-1">
                    {[
                      { name: 'JPG to PDF', op: 'jpg_to_pdf', ext: '.jpg,.jpeg', icon: ImageIcon, color: 'text-amber-500' },
                      { name: 'WORD to PDF', op: 'docx_to_pdf', ext: '.docx,.doc', icon: FileText, color: 'text-blue-600' },
                      { name: 'POWERPOINT to PDF', op: 'pptx_to_pdf', ext: '.pptx,.ppt', icon: Layers, color: 'text-orange-500' },
                      { name: 'EXCEL to PDF', op: 'xlsx_to_pdf', ext: '.xlsx,.xls', icon: FileSpreadsheet, color: 'text-emerald-600' },
                      { name: 'HTML to PDF', op: 'html_to_pdf', ext: '.html,.htm', icon: FileCode, color: 'text-cyan-600' },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.op}
                          onClick={() => handleToolClick(item.op, item.ext)}
                          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors text-left"
                        >
                          <Icon className={`w-4 h-4 ${item.color}`} />
                          <span>{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Convert from PDF
                  </div>
                  <div className="space-y-1">
                    {[
                      { name: 'PDF to JPG', op: 'pdf_to_jpg', ext: '.pdf', icon: ImageIcon, color: 'text-amber-500' },
                      { name: 'PDF to PNG', op: 'pdf_to_png', ext: '.pdf', icon: ImageIcon, color: 'text-teal-500' },
                      { name: 'PDF to WORD', op: 'pdf_to_docx', ext: '.pdf', icon: FileText, color: 'text-blue-600' },
                      { name: 'PDF to TEXT', op: 'pdf_to_txt', ext: '.pdf', icon: FileText, color: 'text-slate-600' },
                      { name: 'PDF to HTML', op: 'pdf_to_html', ext: '.pdf', icon: FileCode, color: 'text-cyan-600' },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.op}
                          onClick={() => handleToolClick(item.op, item.ext)}
                          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors text-left"
                        >
                          <Icon className={`w-4 h-4 ${item.color}`} />
                          <span>{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* All PDF Tools Mega-Menu */}
          <div className="relative" ref={allToolsRef}>
            <button
              onClick={() => {
                setAllToolsDropdownOpen(!allToolsDropdownOpen);
                setConvertDropdownOpen(false);
              }}
              className="flex items-center space-x-1 px-3.5 py-2 rounded-lg hover:text-red-600 hover:bg-red-50/60 transition-colors"
            >
              <span>All PDF Tools</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${allToolsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {allToolsDropdownOpen && (
              <div className="absolute top-full -right-20 mt-2 w-[760px] bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 grid grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-red-600 mb-3 flex items-center space-x-1.5">
                    <span>Organize & Edit</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <button onClick={() => handleToolClick('pdf_rotate', '.pdf')} className="w-full text-left px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                      <RotateCw className="w-4 h-4 text-rose-500" />
                      <span>Rotate PDF</span>
                    </button>
                    <button onClick={() => handleToolClick('pdf_to_docx', '.pdf')} className="w-full text-left px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>PDF to Word</span>
                    </button>
                    <button onClick={() => handleToolClick('pdf_to_html', '.pdf')} className="w-full text-left px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                      <FileCode className="w-4 h-4 text-cyan-600" />
                      <span>PDF to HTML</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-3 flex items-center space-x-1.5">
                    <span>Optimize & OCR</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <button onClick={() => handleToolClick('pdf_compress', '.pdf')} className="w-full text-left px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                      <Minimize2 className="w-4 h-4 text-emerald-500" />
                      <span>Compress PDF</span>
                    </button>
                    <button onClick={() => handleToolClick('pdf_ocr', '.pdf')} className="w-full text-left px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                      <FileCheck2 className="w-4 h-4 text-violet-600" />
                      <span>OCR Searchable PDF</span>
                    </button>
                    <button onClick={() => handleToolClick('image_to_searchable_pdf', '.png,.jpg,.jpeg')} className="w-full text-left px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                      <FileCheck2 className="w-4 h-4 text-indigo-500" />
                      <span>Image to OCR PDF</span>
                    </button>
                    <button onClick={() => handleToolClick('image_to_txt', '.png,.jpg,.jpeg')} className="w-full text-left px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <span>Image to Text</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-3 flex items-center space-x-1.5">
                    <span>Security & Image Tools</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <button onClick={() => handleToolClick('pdf_encrypt', '.pdf')} className="w-full text-left px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                      <Lock className="w-4 h-4 text-red-500" />
                      <span>Protect PDF (AES-256)</span>
                    </button>
                    <button onClick={() => handleToolClick('pdf_decrypt', '.pdf')} className="w-full text-left px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span>Unlock PDF</span>
                    </button>
                    <button onClick={() => handleToolClick('png_to_webp', '.png')} className="w-full text-left px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                      <ImageIcon className="w-4 h-4 text-teal-500" />
                      <span>PNG to WebP</span>
                    </button>
                    <button onClick={() => handleToolClick('image_resize', '.jpg,.png,.webp')} className="w-full text-left px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                      <ImageIcon className="w-4 h-4 text-indigo-500" />
                      <span>Resize Image</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right Badge */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            <span>1-Hour Auto Purge</span>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white p-4 space-y-2">
          <button
            onClick={() => handleToolClick('pdf_compress', '.pdf')}
            className="w-full text-left px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-700 hover:bg-red-50 hover:text-red-600"
          >
            Compress PDF
          </button>
          <button
            onClick={() => handleToolClick('pdf_to_docx', '.pdf')}
            className="w-full text-left px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-700 hover:bg-red-50 hover:text-red-600"
          >
            PDF to Word
          </button>
          <button
            onClick={() => handleToolClick('docx_to_pdf', '.docx,.doc')}
            className="w-full text-left px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-700 hover:bg-red-50 hover:text-red-600"
          >
            Word to PDF
          </button>
          <button
            onClick={() => handleToolClick('pdf_ocr', '.pdf')}
            className="w-full text-left px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-700 hover:bg-red-50 hover:text-red-600"
          >
            OCR PDF
          </button>
        </div>
      )}
    </header>
  );
}
