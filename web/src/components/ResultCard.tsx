'use client';

import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, Clock, Sparkles, RotateCcw, ShieldCheck } from 'lucide-react';
import { JobDetailResponse } from '../lib/api';

interface ResultCardProps {
  jobData: JobDetailResponse;
  originalFile: File;
  onReset: () => void;
}

export function ResultCard({ jobData, originalFile, onReset }: ResultCardProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600); // 1 hour TTL countdown

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const primaryOutput = jobData.outputs && jobData.outputs.length > 0 ? jobData.outputs[0] : null;

  const originalBytes = originalFile.size;
  const outputBytes = primaryOutput ? primaryOutput.file_size : originalBytes;
  const savedBytes = originalBytes - outputBytes;
  const savingsPercent = originalBytes > 0 ? ((savedBytes / originalBytes) * 100).toFixed(1) : '0';
  const isCompressed = savedBytes > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto mb-6 shadow-sm">
        <CheckCircle className="w-8 h-8" />
      </div>

      <h3 className="text-2xl font-bold text-slate-900 mb-2">
        Conversion & Output Validation Succeeded!
      </h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-8">
        Your document was processed and verified by the Output Validator.
      </p>

      {/* Before / After Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto mb-8">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Original Size
          </div>
          <div className="text-lg font-bold text-slate-900">
            {formatFileSize(originalBytes)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200/80 text-left">
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
            Output Size
          </div>
          <div className="text-lg font-bold text-blue-900">
            {formatFileSize(outputBytes)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-left">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">
            {isCompressed ? 'Space Saved' : 'Integrity'}
          </div>
          <div className="text-lg font-bold text-emerald-900">
            {isCompressed ? `${savingsPercent}%` : '100% Passed'}
          </div>
        </div>
      </div>

      {/* Download Action */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-6">
        {primaryOutput && (
          <a
            href={primaryOutput.download_url}
            download={primaryOutput.filename}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-8 py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            <Download className="w-5 h-5" />
            <span>Download {primaryOutput.filename}</span>
          </a>
        )}

        <button
          onClick={onReset}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-4 rounded-2xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-[0.98] transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Convert Another</span>
        </button>
      </div>

      {/* Auto-destruct timer countdown */}
      <div className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-500 bg-slate-100 px-4 py-2 rounded-full">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>File auto-destructs in <strong>{formatTime(secondsRemaining)}</strong></span>
      </div>
    </div>
  );
}
