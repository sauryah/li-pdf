'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface JobProgressProps {
  jobId: string;
  onComplete: () => void;
  onError: (msg: string) => void;
}

export function JobProgress({ jobId, onComplete, onError }: JobProgressProps) {
  const [percent, setPercent] = useState<number>(15);
  const [stepMessage, setStepMessage] = useState<string>('Allocating sandboxed worker...');

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8085';
    const eventSource = new EventSource(`${apiBase}/v1/jobs/${jobId}/events`);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.progress_percent !== undefined) {
          setPercent(data.progress_percent);
        }
        if (data.step) {
          setStepMessage(data.step);
        }
        if (data.progress_percent >= 100) {
          eventSource.close();
          onComplete();
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.addEventListener('progress', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        if (data.progress_percent !== undefined) setPercent(data.progress_percent);
        if (data.step) setStepMessage(data.step);
        if (data.progress_percent >= 100) {
          eventSource.close();
          onComplete();
        }
      } catch (err) {}
    });

    eventSource.onerror = (err) => {
      console.warn('SSE disconnected, polling fallback...');
      // Polling fallback check
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`${apiBase}/v1/jobs/${jobId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.job?.status === 'completed') {
              clearInterval(interval);
              eventSource.close();
              onComplete();
            } else if (data.job?.status === 'failed') {
              clearInterval(interval);
              eventSource.close();
              onError('Job failed during processing.');
            }
          }
        } catch (e) {}
      }, 1000);

      return () => clearInterval(interval);
    };

    return () => {
      eventSource.close();
    };
  }, [jobId, onComplete, onError]);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center shadow-sm">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-6">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-2">
        Processing in Sandbox...
      </h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-8">
        {stepMessage}
      </p>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-3 max-w-lg mx-auto overflow-hidden mb-4">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex justify-between items-center max-w-lg mx-auto text-xs font-semibold text-slate-400">
        <span>Preflight Probing</span>
        <span>Output Validator Gate</span>
        <span>{percent}%</span>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-100 inline-flex items-center space-x-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-4 py-2 rounded-full">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Strict nsjail / network-isolated execution</span>
      </div>
    </div>
  );
}
