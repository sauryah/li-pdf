'use client';

import React from 'react';
import { DocumentSpec } from '../../lib/passport-types';

interface OfficialGuideOverlayProps {
  spec: DocumentSpec;
  showGuides: boolean;
}

export const OfficialGuideOverlay: React.FC<OfficialGuideOverlayProps> = ({ spec, showGuides }) => {
  if (!showGuides) return null;

  const crownTopPct = spec.crown_to_top_margin_pct * 100;
  const targetFacePct = ((spec.face_coverage_min_pct + spec.face_coverage_max_pct) / 2) * 100;
  const chinPct = crownTopPct + targetFacePct;
  const eyeLevelPct = 100 - (spec.eye_level_from_bottom_min_pct ? spec.eye_level_from_bottom_min_pct * 100 : 55);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between overflow-hidden rounded-lg border border-blue-400/40">
      <div className="absolute left-1/2 top-0 bottom-0 w-[1px] -translate-x-1/2 border-r border-dashed border-blue-400/60" />

      <div
        className="absolute left-0 right-0 border-b border-dashed border-emerald-500/80 flex items-center justify-between px-2 text-[9px] font-semibold text-emerald-600 bg-emerald-500/10"
        style={{ top: `${crownTopPct}%` }}
      >
        <span>▲ Crown (Top of Head)</span>
      </div>

      <div
        className="absolute left-0 right-0 border-b border-blue-500/80 flex items-center justify-end px-2 text-[9px] font-semibold text-blue-600 bg-blue-500/10"
        style={{ top: `${eyeLevelPct}%` }}
      >
        <span>● Eye Level</span>
      </div>

      <div
        className="absolute left-0 right-0 border-b border-dashed border-emerald-500/80 flex items-center justify-between px-2 text-[9px] font-semibold text-emerald-600 bg-emerald-500/10"
        style={{ top: `${chinPct}%` }}
      >
        <span>▼ Chin Line</span>
      </div>

      <div className="absolute top-2 right-2 rounded bg-slate-900/80 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
        {spec.width_mm}×{spec.height_mm}mm
      </div>
    </div>
  );
};
