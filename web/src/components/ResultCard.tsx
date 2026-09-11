'use client';

import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, Clock, RotateCcw, ShieldCheck, ArrowDownCircle, FileText } from 'lucide-react';
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
    <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm text-center animate-in fade-in zoom-in-95 duration-200">
      {/* Success Icon */}
      <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto mb-6 shadow-sm">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
        Document Processed Successfully!
      </h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-8">
        Your document has been verified by the Output Validator gate and is ready for download.
      </p>

      {/* Before / After Stats Card */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 max-w-xl mx-auto mb-8">
        {isCompressed && (
          <div className="inline-block bg-emerald-600 text-white text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider mb-4 shadow-sm">
            Your file is now {savingsPercent}% smaller!
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-white rounded-xl border border-slate-200/60">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Original Size
            </div>
            <div className="text-lg font-bold text-slate-800">
              {formatFileSize(originalBytes)}
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200/60">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Processed Size
            </div>
            <div className="text-lg font-bold text-slate-800">
              {formatFileSize(outputBytes)}
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200/60">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {isCompressed ? 'Space Saved' : 'Integrity'}
            </div>
            <div className="text-lg font-bold text-emerald-600">
              {isCompressed ? `-${savingsPercent}%` : '100% Validated'}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Red Download CTA Button */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto mb-8">
        {primaryOutput && (
          <a
            href={primaryOutput.download_url}
            download={primaryOutput.filename}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-3 px-10 py-4.5 rounded-2xl bg-[#E5322D] hover:bg-[#D42227] text-white font-extrabold text-base shadow-xl shadow-red-600/25 hover:shadow-2xl hover:shadow-red-600/35 active:scale-[0.98] transition-all"
          >
            <Download className="w-5 h-5" />
            <span>Download {primaryOutput.filename || 'Processed File'}</span>
          </a>
        )}

        <button
          onClick={onReset}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-4.5 rounded-2xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-100 active:scale-[0.98] transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Convert Another</span>
        </button>
      </div>

      {/* Auto-destruct & Privacy Assurance Badges */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
        <div className="inline-flex items-center space-x-1.5 bg-slate-100 text-slate-600 px-3.5 py-1.5 rounded-full font-medium">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Auto-purges in <strong className="text-slate-800">{formatTime(secondsRemaining)}</strong></span>
        </div>
        <div className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3.5 py-1.5 rounded-full font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Zero Data Retention Active</span>
        </div>
      </div>
    </div>
  );
}
