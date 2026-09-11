'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, File, AlertCircle, Sparkles, FolderUp } from 'lucide-react';

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  isUploading?: boolean;
}

export function Dropzone({ onFileSelected, isUploading = false }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = (file: File) => {
    setError(null);
    const maxBytes = 500 * 1024 * 1024; // 500 MB
    if (file.size > maxBytes) {
      setError('File exceeds maximum limit of 500MB.');
      return;
    }
    onFileSelected(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-red-500 bg-red-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-red-400 bg-white hover:bg-slate-50/40 shadow-sm hover:shadow'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          disabled={isUploading}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.odt,.rtf,.txt,.html"
        />

        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mb-5 shadow-sm">
          <UploadCloud className="w-8 h-8" />
        </div>

        <div className="mb-6">
          <button
            type="button"
            className="inline-flex items-center space-x-2 px-8 py-4 rounded-2xl bg-red-600 text-white text-base font-bold shadow-lg shadow-red-600/25 hover:bg-red-700 active:scale-[0.98] transition-all"
          >
            <FolderUp className="w-5 h-5" />
            <span>Select PDF or Document</span>
          </button>
          <p className="text-xs text-slate-400 mt-2 font-medium">or drop files here</p>
        </div>

        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          Supports <span className="font-semibold text-slate-700">PDF, Word (DOCX), Excel (XLSX), PPTX, Images (JPG, PNG, WebP), RTF, TXT, HTML</span> up to 500MB.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium text-slate-400">
          <span>⚡ Sub-second engine routing</span>
          <span>•</span>
          <span>🔒 Non-root sandbox isolation</span>
          <span>•</span>
          <span>🛡️ 1-Hour ephemeral auto-deletion</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
