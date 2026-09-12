'use client';

import React, { useMemo } from 'react';
import { DocumentSpec, PDFGenerateRequest } from '../../lib/passport-types';
import { Grid, Scissors, SlidersHorizontal, Check } from 'lucide-react';

interface PrintSheetCustomizerProps {
  spec: DocumentSpec;
  photoUrl: string;
  pdfParams: PDFGenerateRequest;
  onPdfParamsChange: (newParams: Partial<PDFGenerateRequest>) => void;
}

export const PrintSheetCustomizer: React.FC<PrintSheetCustomizerProps> = ({
  spec,
  photoUrl,
  pdfParams,
  onPdfParamsChange,
}) => {
  const gridInfo = useMemo(() => {
    const is4x6 = pdfParams.paper_size.toUpperCase() === '4X6';
    const paperW_mm = is4x6 ? 101.6 : 210.0;
    const paperH_mm = is4x6 ? 152.4 : 297.0;

    const margin_mm = pdfParams.margin_mm;
    const spacing_mm = pdfParams.spacing_mm;
    const headerReserved_mm = 12.0;
    const footerReserved_mm = 8.0;

    const availW_mm = paperW_mm - 2 * margin_mm;
    const availH_mm = paperH_mm - 2 * margin_mm - headerReserved_mm - footerReserved_mm;

    const cols = Math.max(1, Math.floor((availW_mm + spacing_mm) / (spec.width_mm + spacing_mm)));
    const rows = Math.max(1, Math.floor((availH_mm + spacing_mm) / (spec.height_mm + spacing_mm)));
    const totalCount = cols * rows;

    return {
      paperW_mm,
      paperH_mm,
      cols,
      rows,
      totalCount,
      is4x6,
    };
  }, [pdfParams.paper_size, pdfParams.margin_mm, pdfParams.spacing_mm, spec.width_mm, spec.height_mm]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-100 p-6 shadow-inner">
          <div className="w-full flex items-center justify-between text-xs text-slate-500 font-semibold mb-3">
            <span className="flex items-center gap-1.5">
              <Grid className="h-4 w-4 text-[#E5322D]" />
              <span>
                {gridInfo.is4x6 ? '4 × 6 Inch Sheet' : 'A4 Print Sheet'} ({gridInfo.cols} × {gridInfo.rows} = {gridInfo.totalCount} Copies)
              </span>
            </span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">
              Scale: 100% (300 DPI)
            </span>
          </div>

          <div
            className="relative bg-white shadow-2xl rounded-sm p-4 border border-slate-300 flex flex-col justify-between overflow-hidden transition-all duration-200"
            style={{
              width: '100%',
              maxWidth: gridInfo.is4x6 ? '340px' : '440px',
              aspectRatio: `${gridInfo.paperW_mm} / ${gridInfo.paperH_mm}`,
            }}
          >
            <div className="text-center border-b border-slate-100 pb-1">
              <p className="text-[9px] font-extrabold text-slate-800 tracking-wider">
                LI.PDF — {spec.name.toUpperCase()} PRINT SHEET
              </p>
              <p className="text-[7.5px] text-slate-500">
                Size: {spec.width_mm}×{spec.height_mm}mm | 300 DPI | Copies: {gridInfo.totalCount}
              </p>
            </div>

            <div
              className="my-auto grid items-center justify-center gap-1.5 py-2"
              style={{
                gridTemplateColumns: `repeat(${gridInfo.cols}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: gridInfo.totalCount }).map((_, idx) => (
                <div
                  key={idx}
                  className={`relative overflow-hidden bg-white shadow-xs ${
                    pdfParams.include_crop_marks ? 'border border-dashed border-slate-400' : ''
                  }`}
                  style={{
                    aspectRatio: `${spec.width_mm} / ${spec.height_mm}`,
                  }}
                >
                  <img
                    src={photoUrl}
                    alt={`Copy ${idx + 1}`}
                    className="h-full w-full object-cover select-none"
                  />
                  {pdfParams.include_crop_marks && (
                    <div className="absolute inset-0 border border-slate-300 pointer-events-none" />
                  )}
                </div>
              ))}
            </div>

            <div className="text-center border-t border-slate-100 pt-1">
              <p className="text-[7.5px] font-bold text-red-600">
                ⚠️ CRITICAL PRINT SETTING: Set Scale to 100% / Actual Size. Do NOT select &apos;Fit to Page&apos;.
              </p>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-500 text-center">
            Designed for standard home/office inkjets and commercial photo lab printers.
          </p>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <SlidersHorizontal className="h-4 w-4 text-[#E5322D]" />
            <h3 className="text-sm font-bold text-slate-900">Sheet Layout & Options</h3>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">Paper Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onPdfParamsChange({ paper_size: 'A4' })}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
                  pdfParams.paper_size === 'A4'
                    ? 'border-[#E5322D] bg-red-50/50 ring-2 ring-[#E5322D]/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-900">A4 Paper</span>
                  {pdfParams.paper_size === 'A4' && <Check className="h-4 w-4 text-[#E5322D]" />}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5">210 × 297 mm</span>
              </button>

              <button
                type="button"
                onClick={() => onPdfParamsChange({ paper_size: '4X6' })}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
                  pdfParams.paper_size === '4X6'
                    ? 'border-[#E5322D] bg-red-50/50 ring-2 ring-[#E5322D]/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-900">4 × 6 Inch (4R)</span>
                  {pdfParams.paper_size === '4X6' && <Check className="h-4 w-4 text-[#E5322D]" />}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5">10 × 15 cm Photo Paper</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-slate-600" />
              <div>
                <p className="text-xs font-bold text-slate-900">Cutting Crop Marks</p>
                <p className="text-[11px] text-slate-500">Dashed scissor lines around each photo</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={pdfParams.include_crop_marks}
              onChange={(e) => onPdfParamsChange({ include_crop_marks: e.target.checked })}
              className="h-4 w-4 rounded text-[#E5322D] focus:ring-red-500 cursor-pointer accent-[#E5322D]"
            />
          </div>

          <div className="space-y-4 pt-1 border-t border-slate-100">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700">Page Margin</span>
                <span className="font-mono text-slate-500">{pdfParams.margin_mm} mm</span>
              </div>
              <input
                type="range"
                min="5"
                max="25"
                step="1"
                value={pdfParams.margin_mm}
                onChange={(e) => onPdfParamsChange({ margin_mm: parseFloat(e.target.value) })}
                className="w-full accent-[#E5322D] cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700">Spacing Between Photos</span>
                <span className="font-mono text-slate-500">{pdfParams.spacing_mm} mm</span>
              </div>
              <input
                type="range"
                min="2"
                max="12"
                step="1"
                value={pdfParams.spacing_mm}
                onChange={(e) => onPdfParamsChange({ spacing_mm: parseFloat(e.target.value) })}
                className="w-full accent-[#E5322D] cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
