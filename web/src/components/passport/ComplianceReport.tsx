'use client';

import React from 'react';
import { ComplianceReport as ComplianceReportType, DocumentSpec } from '../../lib/passport-types';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Info } from 'lucide-react';

interface ComplianceReportProps {
  report: ComplianceReportType;
  spec: DocumentSpec;
}

export const ComplianceReport: React.FC<ComplianceReportProps> = ({ report, spec }) => {
  const isPassed = report.overall_compliant;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Compliance & Quality Checks</h3>
        </div>
        
        {isPassed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            100% Compliant
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            {report.warnings.length} Warning(s)
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {report.items.map((item) => {
          const isPass = item.status === 'pass';
          const isWarn = item.status === 'warn';

          return (
            <div
              key={item.id}
              className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs transition-colors ${
                isPass
                  ? 'border-slate-100 bg-slate-50/60'
                  : isWarn
                  ? 'border-amber-200 bg-amber-50/40'
                  : 'border-red-200 bg-red-50/40'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isPass ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : isWarn ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900">{item.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.message}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-blue-50/60 p-3 text-[11px] text-blue-900 border border-blue-100">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">{spec.name} Standard: </span>
          <span>
            {spec.width_mm}×{spec.height_mm}mm physical dimensions, head filling {Math.round(spec.face_coverage_min_pct*100)}%–{Math.round(spec.face_coverage_max_pct*100)}% of frame on plain background.
          </span>
        </div>
      </div>
    </div>
  );
};
