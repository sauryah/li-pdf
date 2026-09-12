'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { DocumentSelector } from '../../components/passport/DocumentSelector';
import { ProcessingProgress } from '../../components/passport/ProcessingProgress';
import { PreviewEditor } from '../../components/passport/PreviewEditor';
import { PrintSheetCustomizer } from '../../components/passport/PrintSheetCustomizer';
import { DownloadActions } from '../../components/passport/DownloadActions';
import { PrivacyModal } from '../../components/passport/PrivacyModal';
import {
  DocumentSpec,
  ProcessResponse,
  AdjustRequest,
  PDFGenerateRequest
} from '../../lib/passport-types';
import {
  fetchAllSpecs,
  processPhoto,
  adjustPhoto
} from '../../lib/passport-api';
import {
  Sparkles,
  ArrowLeft,
  Printer,
  Sliders,
  UploadCloud,
  Image as ImageIcon,
  CheckCircle2,
  Shield,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export default function PassportPhotoPage() {
  const [specs, setSpecs] = useState<DocumentSpec[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<string>('in_passport');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'print_sheet'>('editor');
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  // Drag & drop state for hero
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Adjustments state
  const [adjustState, setAdjustState] = useState<AdjustRequest>({
    session_id: '',
    doc_id: 'in_passport',
    zoom: 1.0,
    offset_x_pct: 0.0,
    offset_y_pct: 0.0,
    rotate_deg: 0.0,
    background_color: '#FFFFFF',
    brightness: 0.0,
    contrast: 0.0,
  });

  // PDF Sheet settings state
  const [pdfParams, setPdfParams] = useState<PDFGenerateRequest>({
    session_id: '',
    doc_id: 'in_passport',
    paper_size: 'A4',
    include_crop_marks: true,
    margin_mm: 10.0,
    spacing_mm: 4.0,
  });

  // Load document specifications on mount
  useEffect(() => {
    fetchAllSpecs().then((loadedSpecs) => {
      setSpecs(loadedSpecs);
    });
  }, []);

  const currentSpec = specs.find((s) => s.id === selectedSpecId) || specs[0] || {
    id: 'in_passport',
    country: 'India',
    country_code: 'IN',
    name: 'India Passport',
    category: 'passport',
    width_mm: 35.0,
    height_mm: 45.0,
    dpi: 300,
    face_coverage_min_pct: 0.70,
    face_coverage_max_pct: 0.80,
    crown_to_top_margin_pct: 0.08,
    default_background_color: '#FFFFFF',
    allowed_background_colors: ['#FFFFFF', '#F3F4F6', '#E5E7EB'],
    description: '35 x 45 mm, 70-80% face coverage, white background.',
    target_width_px: 413,
    target_height_px: 531
  };

  // Process uploaded image file
  const handleProcessImage = async (file: File, specId: string) => {
    try {
      setIsProcessing(true);
      const res = await processPhoto(file, specId);
      setProcessResult(res);
      setUploadedFile(file);

      const initialAdjust: AdjustRequest = {
        session_id: res.session_id,
        doc_id: specId,
        zoom: 1.0,
        offset_x_pct: 0.0,
        offset_y_pct: 0.0,
        rotate_deg: 0.0,
        background_color: res.spec.default_background_color || '#FFFFFF',
        brightness: 0.0,
        contrast: 0.0,
      };
      setAdjustState(initialAdjust);

      setPdfParams({
        session_id: res.session_id,
        doc_id: specId,
        paper_size: 'A4',
        include_crop_marks: true,
        margin_mm: 10.0,
        spacing_mm: 4.0,
      });
    } catch (err: any) {
      alert(`Processing error: ${err.message || 'Unable to process image. Make sure the photo engine backend is running.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Demo sample photo loader
  const handleUseDemoSample = async () => {
    try {
      const response = await fetch('/samples/sample_portrait.jpg');
      const blob = await response.blob();
      const file = new File([blob], 'demo_sample_portrait.jpg', { type: 'image/jpeg' });
      handleProcessImage(file, selectedSpecId);
    } catch (err) {
      alert('Could not load sample portrait.');
    }
  };

  // Document spec switch
  const handleSpecSelect = (specId: string) => {
    setSelectedSpecId(specId);
    if (uploadedFile) {
      handleProcessImage(uploadedFile, specId);
    }
  };

  // Debounced adjustment handler
  const adjustTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleAdjustChange = useCallback(
    (newParams: Partial<AdjustRequest>) => {
      setAdjustState((prev) => {
        const updated = { ...prev, ...newParams };

        if (adjustTimeoutRef.current) {
          clearTimeout(adjustTimeoutRef.current);
        }

        adjustTimeoutRef.current = setTimeout(async () => {
          if (!updated.session_id) return;
          try {
            setIsAdjusting(true);
            const res = await adjustPhoto(updated);
            setProcessResult(res);
          } catch (err) {
            console.error('Failed to apply adjustments', err);
          } finally {
            setIsAdjusting(false);
          }
        }, 120);

        return updated;
      });
    },
    []
  );

  const handleResetAdjust = () => {
    if (!processResult) return;
    const resetState: Partial<AdjustRequest> = {
      zoom: 1.0,
      offset_x_pct: 0.0,
      offset_y_pct: 0.0,
      rotate_deg: 0.0,
      background_color: currentSpec.default_background_color || '#FFFFFF',
      brightness: 0.0,
      contrast: 0.0,
    };
    handleAdjustChange(resetState);
  };

  const handlePdfParamsChange = (newParams: Partial<PDFGenerateRequest>) => {
    setPdfParams((prev) => ({ ...prev, ...newParams }));
  };

  const handleStartNew = () => {
    setProcessResult(null);
    setUploadedFile(null);
    setActiveTab('editor');
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-slate-50 text-slate-900 font-sans">
      {!processResult && !isProcessing && (
          <div>
            {/* Hero Section */}
            <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 bg-gradient-to-b from-red-50/40 via-white to-slate-50 border-b border-slate-200/60">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3.5 py-1 text-xs font-semibold text-[#E5322D] ring-1 ring-inset ring-red-600/20">
                    <Sparkles className="h-3.5 w-3.5 text-[#E5322D]" />
                    <span>AI Passport Photo & Document Utility</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                    Create Passport Photos <span className="text-[#E5322D]">in Seconds</span>
                  </h1>

                  <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                    Upload your portrait photo and we&apos;ll automatically crop, remove background, resize, and prepare a
                    <strong className="text-slate-900 font-semibold"> print-ready A4 &amp; 4×6&quot; sheet</strong> at 300 DPI.
                  </p>
                </div>

                {/* Upload Dropzone Container */}
                <div className="mt-10 max-w-2xl mx-auto">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const file = e.dataTransfer.files[0];
                        if (file.type.startsWith('image/')) {
                          handleProcessImage(file, selectedSpecId);
                        }
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative group cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 shadow-sm hover:shadow-md ${
                      isDragOver
                        ? 'border-[#E5322D] bg-red-50/60 scale-[1.01]'
                        : 'border-slate-300 hover:border-red-400 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleProcessImage(e.target.files[0], selectedSpecId);
                        }
                      }}
                      disabled={isProcessing}
                    />

                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-[#E5322D] group-hover:bg-[#E5322D] group-hover:text-white transition-all duration-200 shadow-inner">
                        <UploadCloud className="h-8 w-8" />
                      </div>

                      <div>
                        <p className="text-lg font-bold text-slate-900">
                          Click to upload or drag &amp; drop your portrait
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Supports JPG, PNG, WEBP, HEIC (Max 20MB)
                        </p>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#E5322D] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-red-500/25 hover:bg-red-600 transition-all active:scale-[0.98]"
                        >
                          <UploadCloud className="h-4 w-4" />
                          <span>{isProcessing ? 'Processing Photo...' : 'Upload Photo'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 px-2">
                    <button
                      type="button"
                      onClick={() => setPrivacyModalOpen(true)}
                      className="flex items-center gap-1.5 text-emerald-600 font-medium hover:underline"
                    >
                      <Shield className="h-4 w-4" />
                      <span>100% Private: Photos deleted automatically</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleUseDemoSample}
                      className="inline-flex items-center gap-1.5 font-semibold text-[#E5322D] hover:text-red-700 hover:underline cursor-pointer"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>Or try with Sample Portrait</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Highlights Grid */}
                <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto pt-8 border-t border-slate-200/80">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-[#E5322D]">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Official Specifications</h4>
                      <p className="text-xs text-slate-500 mt-0.5">India, US, UK, Schengen &amp; custom formats with exact face ratios.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">AI Background Matting</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Isolates portrait and replaces background with plain white or light grey.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">A4 &amp; 4×6&quot; PDF Print Sheet</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Millimeter-accurate vector PDF with crop marks for clean scissor cutting.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Document Selector section */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Select Document Format</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Choose your target document to automatically calibrate face ratio and dimensions.</p>
                </div>
              </div>

              <DocumentSelector
                specs={specs}
                selectedSpecId={selectedSpecId}
                onSelectSpec={handleSpecSelect}
              />
            </div>
          </div>
        )}

        {/* Processing Screen */}
        {isProcessing && (
          <div className="py-20 px-4">
            <ProcessingProgress />
          </div>
        )}

        {/* Studio & Result Screen */}
        {processResult && !isProcessing && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <button
                type="button"
                onClick={handleStartNew}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#E5322D] transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Upload Different Photo</span>
              </button>

              <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'editor'
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sliders className="h-4 w-4 text-[#E5322D]" />
                  <span>Passport Studio &amp; Compliance</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('print_sheet')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'print_sheet'
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Printer className="h-4 w-4 text-indigo-600" />
                  <span>Print Sheet Generator ({pdfParams.paper_size})</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Studio */}
            {activeTab === 'editor' && (
              <PreviewEditor
                data={processResult}
                selectedSpec={currentSpec}
                adjustState={adjustState}
                onAdjustChange={handleAdjustChange}
                onResetAdjust={handleResetAdjust}
                isAdjusting={isAdjusting}
              />
            )}

            {/* Tab 2: Print Sheet */}
            {activeTab === 'print_sheet' && (
              <PrintSheetCustomizer
                spec={currentSpec}
                photoUrl={processResult.preview_data_url}
                pdfParams={pdfParams}
                onPdfParamsChange={handlePdfParamsChange}
              />
            )}

            {/* Document Selector switcher */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Switch Target Document:</h3>
              <DocumentSelector
                specs={specs}
                selectedSpecId={selectedSpecId}
                onSelectSpec={handleSpecSelect}
              />
            </div>

            {/* Download Actions */}
            <DownloadActions
              sessionId={processResult.session_id}
              spec={currentSpec}
              pdfParams={pdfParams}
              onNewPhoto={handleStartNew}
            />
          </div>
        )}

      <PrivacyModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />
    </div>
  );
}
