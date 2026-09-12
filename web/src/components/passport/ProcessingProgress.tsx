'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, ScanFace, Scissors, Sparkles, ShieldCheck } from 'lucide-react';

interface ProcessingProgressProps {
  stage?: number;
}

export const ProcessingProgress: React.FC<ProcessingProgressProps> = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { title: 'Detecting Face & Landmarks', icon: ScanFace, desc: 'Locating pupils, chin, forehead, and roll orientation' },
    { title: 'AI Portrait Matting & Segmentation', icon: Scissors, desc: 'Isolating subject and feathering natural hair edges' },
    { title: 'Applying Document Crop & Centering', icon: Sparkles, desc: 'Aligning head ratio and physical millimeter bounds' },
    { title: 'Running 6-Point Compliance Check', icon: ShieldCheck, desc: 'Validating sharpness, tilt, lighting, and 300 DPI ready' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 400);

    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-[#E5322D] animate-pulse">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Preparing Your Passport Photo</h3>
        <p className="text-xs text-slate-500">Processing with high-precision AI vision pipeline...</p>
      </div>

      <div className="mt-8 space-y-4">
        {steps.map((step, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;
          const Icon = step.icon;

          return (
            <div
              key={idx}
              className={`flex items-start gap-3 rounded-xl p-3 transition-all duration-300 ${
                isCurrent
                  ? 'bg-red-50/80 border border-red-200 scale-[1.02]'
                  : isDone
                  ? 'bg-slate-50 opacity-90'
                  : 'opacity-40'
              }`}
            >
              <div className="mt-0.5">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : isCurrent ? (
                  <Loader2 className="h-5 w-5 text-[#E5322D] animate-spin" />
                ) : (
                  <Icon className="h-5 w-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-900">{step.title}</p>
                <p className="text-[11px] text-slate-500">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
