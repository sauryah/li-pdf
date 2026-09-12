'use client';

import React, { useState } from 'react';
import { PDFGenerateRequest, DocumentSpec } from '../../lib/passport-types';
import { downloadPDF, downloadSheetImage, getSinglePhotoDownloadUrl } from '../../lib/passport-api';
import { FileDown, Image as ImageIcon, Printer, FileText, Loader2 } from 'lucide-react';

interface DownloadActionsProps {
  sessionId: string;
  spec: DocumentSpec;
  pdfParams: PDFGenerateRequest;
  onNewPhoto: () => void;
}

export const DownloadActions: React.FC<DownloadActionsProps> = ({
  sessionId,
  spec,
  pdfParams,
  onNewPhoto
}) => {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingJpg, setIsDownloadingJpg] = useState(false);
  const [isDownloadingSingle, setIsDownloadingSingle] = useState(false);

  const handleDownloadPDF = async () => {
    try {
      setIsDownloadingPdf(true);
      await downloadPDF(pdfParams);
    } catch (err) {
      alert('Failed to download PDF. Please ensure the Photo Engine backend is running.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadSheetImage = async () => {
    try {
      setIsDownloadingJpg(true);
      await downloadSheetImage(pdfParams);
    } catch (err) {
      alert('Failed to download print sheet image.');
    } finally {
      setIsDownloadingJpg(false);
    }
  };

  const handleDownloadSingle = () => {
    setIsDownloadingSingle(true);
    const url = getSinglePhotoDownloadUrl(sessionId, 'jpg');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spec.id}_single_photo_300dpi.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setIsDownloadingSingle(false), 800);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Download & Print Options</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Your photos are ready in official {spec.width_mm}×{spec.height_mm}mm format @ 300 DPI.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewPhoto}
          className="text-xs font-semibold text-slate-600 hover:text-[#E5322D] transition-colors cursor-pointer"
        >
          + Upload Another Photo
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={isDownloadingPdf}
          className="group relative flex flex-col items-start justify-between rounded-xl bg-gradient-to-tr from-[#E5322D] to-red-600 p-5 text-white shadow-lg shadow-red-500/25 hover:from-red-600 hover:to-red-700 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
              {isDownloadingPdf ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileDown className="h-5 w-5" />
              )}
            </div>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Recommended
            </span>
          </div>

          <div className="mt-4 text-left">
            <h4 className="text-sm font-bold">Download {pdfParams.paper_size} PDF Sheet</h4>
            <p className="text-xs text-red-100 mt-0.5">
              Vector true-scale PDF with cutting guidelines.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={handleDownloadSingle}
          disabled={isDownloadingSingle}
          className="group flex flex-col items-start justify-between rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm hover:border-red-300 hover:bg-slate-50 transition-all active:scale-[0.98] cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-red-50 group-hover:text-[#E5322D] transition-colors">
              <ImageIcon className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-500">
              300 DPI
            </span>
          </div>

          <div className="mt-4 text-left">
            <h4 className="text-sm font-bold">Download Single JPG</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Individual digital photo for online passport/visa portals.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={handleDownloadSheetImage}
          disabled={isDownloadingJpg}
          className="group flex flex-col items-start justify-between rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm hover:border-red-300 hover:bg-slate-50 transition-all active:scale-[0.98] cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-red-50 group-hover:text-[#E5322D] transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-500">
              Kiosk JPG
            </span>
          </div>

          <div className="mt-4 text-left">
            <h4 className="text-sm font-bold">Download Sheet Image</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Composite JPG for printing at local photo labs & kiosks.
            </p>
          </div>
        </button>
      </div>

      <div id="print-guide" className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 space-y-1.5">
        <p className="font-bold flex items-center gap-1.5 text-amber-950">
          <Printer className="h-4 w-4 text-amber-700" />
          <span>Important Printing Instructions for Accurate Physical Dimensions:</span>
        </p>
        <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-900/90">
          <li>
            In your printer dialog, ensure <strong>Page Scaling is set to 100% (Actual Size)</strong>.
          </li>
          <li>
            <strong>Do NOT</strong> check <em>&ldquo;Fit to Page&rdquo;</em> or <em>&ldquo;Shrink to Printable Area&rdquo;</em>, as this will distort official millimeter dimensions.
          </li>
          <li>
            For best results, use glossy or matte heavy photo paper (200+ gsm).
          </li>
        </ul>
      </div>
    </div>
  );
};
