'use client';

import React, { useState } from 'react';
import { ProcessResponse, DocumentSpec, AdjustRequest } from '../../lib/passport-types';
import { OfficialGuideOverlay } from './OfficialGuideOverlay';
import { ManualAdjustControls } from './ManualAdjustControls';
import { ComplianceReport } from './ComplianceReport';
import { Eye, EyeOff } from 'lucide-react';

interface PreviewEditorProps {
  data: ProcessResponse;
  selectedSpec: DocumentSpec;
  adjustState: AdjustRequest;
  onAdjustChange: (newState: Partial<AdjustRequest>) => void;
  onResetAdjust: () => void;
  isAdjusting: boolean;
}

export const PreviewEditor: React.FC<PreviewEditorProps> = ({
  data,
  selectedSpec,
  adjustState,
  onAdjustChange,
  onResetAdjust,
  isAdjusting
}) => {
  const [showGuides, setShowGuides] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'compare'>('preview');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E5322D] text-xs font-bold text-white shadow-sm">
            {selectedSpec.country_code}
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">{selectedSpec.name}</h3>
            <p className="text-[11px] text-slate-500 font-medium">
              {selectedSpec.width_mm} × {selectedSpec.height_mm} mm ({data.dimensions.width_px} × {data.dimensions.height_px} px @ {data.dimensions.dpi} DPI)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuides(!showGuides)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              showGuides
                ? 'border-[#E5322D] bg-red-50 text-[#E5322D] shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showGuides ? <Eye className="h-3.5 w-3.5 text-[#E5322D]" /> : <EyeOff className="h-3.5 w-3.5 text-slate-400" />}
            <span>{showGuides ? 'Official Guides: On' : 'Guides: Off'}</span>
          </button>

          <div className="inline-flex rounded-xl bg-slate-200/70 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Passport Photo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('compare')}
              className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                activeTab === 'compare'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Compare Original
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-900/5 p-6 backdrop-blur-sm">
          {activeTab === 'preview' ? (
            <div
              className="relative overflow-hidden rounded-xl border-2 border-white shadow-2xl transition-all"
              style={{
                width: '100%',
                maxWidth: '280px',
                aspectRatio: `${selectedSpec.width_mm} / ${selectedSpec.height_mm}`,
                backgroundColor: adjustState.background_color
              }}
            >
              <img
                src={data.preview_data_url}
                alt="Passport Photo Prepared"
                className="h-full w-full object-cover select-none"
              />
              <OfficialGuideOverlay spec={selectedSpec} showGuides={showGuides} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 w-full max-w-md">
              <div className="space-y-1.5 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Original</span>
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-300 bg-white shadow">
                  <img
                    src={data.original_image_url}
                    alt="Original Upload"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-center">
                <span className="text-[11px] font-bold text-[#E5322D] uppercase tracking-wider">Prepared</span>
                <div
                  className="relative overflow-hidden rounded-xl border-2 border-[#E5322D] shadow-md"
                  style={{
                    aspectRatio: `${selectedSpec.width_mm} / ${selectedSpec.height_mm}`,
                    backgroundColor: adjustState.background_color
                  }}
                >
                  <img
                    src={data.preview_data_url}
                    alt="Passport Result"
                    className="h-full w-full object-cover"
                  />
                  <OfficialGuideOverlay spec={selectedSpec} showGuides={showGuides} />
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Exact 300 DPI physical scale active</span>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-5">
          <ManualAdjustControls
            adjustState={adjustState}
            spec={selectedSpec}
            onChange={onAdjustChange}
            onReset={onResetAdjust}
            isAdjusting={isAdjusting}
          />

          <ComplianceReport report={data.compliance} spec={selectedSpec} />
        </div>
      </div>
    </div>
  );
};
