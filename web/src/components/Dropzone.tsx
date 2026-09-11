'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, File, AlertCircle, Sparkles } from 'lucide-react';

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
            ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/50 shadow-sm hover:shadow'
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

        <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 shadow-sm">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-semibold text-slate-900 mb-2">
          Drop your Document, PDF, or Image here
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          Supports <span className="font-medium text-slate-700">PDF, DOCX, XLSX, PPTX, RTF, TXT, HTML, JPG, PNG, WebP</span> up to 500MB. Direct-to-storage streaming with zero server payload buffering.
        </p>

        <div className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-colors">
          <span>Choose File from Computer</span>
        </div>

        <div className="mt-6 flex items-center justify-center space-x-4 text-xs font-medium text-slate-400">
          <span>⚡ Sub-second engine routing</span>
          <span>•</span>
          <span>🔒 Network-isolated sandbox</span>
          <span>•</span>
          <span>🛡️ Ephemeral TTL storage</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
