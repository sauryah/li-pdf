'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  fetchCapabilities,
  requestPresignedUpload,
  uploadFileToPresigned,
  createJob,
  fetchJobDetails,
  Capability,
  JobDetailResponse,
} from '../lib/api';
import { Dropzone } from '../components/Dropzone';
import { CapabilitiesSelector } from '../components/CapabilitiesSelector';
import { JobProgress } from '../components/JobProgress';
import { ResultCard } from '../components/ResultCard';
import {
  ShieldCheck,
  Zap,
  Lock,
  Sparkles,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Minimize2,
  FileCheck2,
  RotateCw,
  FileCode,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Split,
  Combine,
  Unlock,
} from 'lucide-react';

type Step = 'idle' | 'configuring' | 'uploading' | 'processing' | 'completed' | 'failed';
type CategoryTab = 'all' | 'organize' | 'optimize' | 'convert_to' | 'convert_from' | 'security' | 'image';

interface ToolItem {
  id: string;
  name: string;
  description: string;
  category: CategoryTab;
  operation: string;
  accepts: string;
  badge?: string;
  icon: any;
  iconBg: string;
  iconColor: string;
}

const TOOLS_CATALOG: ToolItem[] = [
  // Organize PDF
  {
    id: 'pdf_rotate',
    name: 'Rotate PDF',
    description: 'Rotate your PDF pages horizontally or vertically. Save and download your permanently adjusted pages.',
    category: 'organize',
    operation: 'pdf_rotate',
    accepts: '.pdf',
    badge: 'Organize',
    icon: RotateCw,
    iconBg: 'bg-red-50 group-hover:bg-red-600',
    iconColor: 'text-[#E5322D] group-hover:text-white',
  },
  {
    id: 'pdf_to_html',
    name: 'PDF to HTML',
    description: 'Convert PDF files into responsive, clean XHTML/HTML web pages retaining font metrics.',
    category: 'organize',
    operation: 'pdf_to_html',
    accepts: '.pdf',
    badge: 'Web Ready',
    icon: FileCode,
    iconBg: 'bg-cyan-50 group-hover:bg-cyan-600',
    iconColor: 'text-cyan-600 group-hover:text-white',
  },

  // Optimize PDF
  {
    id: 'pdf_compress',
    name: 'Compress PDF',
    description: 'Reduce file size while optimizing for maximum PDF quality with smart raster classification.',
    category: 'optimize',
    operation: 'pdf_compress',
    accepts: '.pdf',
    badge: 'Popular',
    icon: Minimize2,
    iconBg: 'bg-emerald-50 group-hover:bg-emerald-600',
    iconColor: 'text-emerald-600 group-hover:text-white',
  },
  {
    id: 'pdf_ocr',
    name: 'OCR PDF',
    description: 'Convert scanned non-selectable PDF documents into fully searchable PDFs with an accurate text layer.',
    category: 'optimize',
    operation: 'pdf_ocr',
    accepts: '.pdf',
    badge: 'Tesseract 5',
    icon: FileCheck2,
    iconBg: 'bg-violet-50 group-hover:bg-violet-600',
    iconColor: 'text-violet-600 group-hover:text-white',
  },

  // Convert to PDF
  {
    id: 'jpg_to_pdf',
    name: 'JPG to PDF',
    description: 'Convert JPG, JPEG, and PNG images to PDF documents in seconds. Easily adjust orientation and margins.',
    category: 'convert_to',
    operation: 'jpg_to_pdf',
    accepts: '.jpg,.jpeg,.png',
    badge: 'Image',
    icon: ImageIcon,
    iconBg: 'bg-amber-50 group-hover:bg-amber-600',
    iconColor: 'text-amber-600 group-hover:text-white',
  },
  {
    id: 'docx_to_pdf',
    name: 'WORD to PDF',
    description: 'Convert Microsoft Word (.docx, .doc) documents into standard pixel-perfect PDFs with exact formatting.',
    category: 'convert_to',
    operation: 'docx_to_pdf',
    accepts: '.docx,.doc',
    badge: 'Office',
    icon: FileText,
    iconBg: 'bg-blue-50 group-hover:bg-blue-600',
    iconColor: 'text-blue-600 group-hover:text-white',
  },
  {
    id: 'pptx_to_pdf',
    name: 'POWERPOINT to PDF',
    description: 'Convert Microsoft PowerPoint presentations (.pptx, .ppt) into crisp PDF slide decks.',
    category: 'convert_to',
    operation: 'pptx_to_pdf',
    accepts: '.pptx,.ppt',
    badge: 'Slides',
    icon: Layers,
    iconBg: 'bg-orange-50 group-hover:bg-orange-600',
    iconColor: 'text-orange-600 group-hover:text-white',
  },
  {
    id: 'xlsx_to_pdf',
    name: 'EXCEL to PDF',
    description: 'Convert Microsoft Excel spreadsheets (.xlsx, .xls) into high-fidelity printable PDF sheets.',
    category: 'convert_to',
    operation: 'xlsx_to_pdf',
    accepts: '.xlsx,.xls',
    badge: 'Spreadsheet',
    icon: FileSpreadsheet,
    iconBg: 'bg-emerald-50 group-hover:bg-emerald-600',
    iconColor: 'text-emerald-700 group-hover:text-white',
  },

  // Convert from PDF
  {
    id: 'pdf_to_docx',
    name: 'PDF to WORD',
    description: 'Convert PDF documents to editable Microsoft Word (.docx) files with unmatched precision.',
    category: 'convert_from',
    operation: 'pdf_to_docx',
    accepts: '.pdf',
    badge: 'Editable',
    icon: FileText,
    iconBg: 'bg-blue-50 group-hover:bg-blue-600',
    iconColor: 'text-blue-600 group-hover:text-white',
  },
  {
    id: 'pdf_to_jpg',
    name: 'PDF to JPG',
    description: 'Extract all pages from your PDF or convert each PDF page into high-resolution 300 DPI JPG images.',
    category: 'convert_from',
    operation: 'pdf_to_jpg',
    accepts: '.pdf',
    badge: '300 DPI',
    icon: ImageIcon,
    iconBg: 'bg-amber-50 group-hover:bg-amber-600',
    iconColor: 'text-amber-600 group-hover:text-white',
  },
  {
    id: 'pdf_to_png',
    name: 'PDF to PNG',
    description: 'Render crisp lossless transparent PNG raster images from your PDF pages.',
    category: 'convert_from',
    operation: 'pdf_to_png',
    accepts: '.pdf',
    badge: 'Lossless',
    icon: ImageIcon,
    iconBg: 'bg-teal-50 group-hover:bg-teal-600',
    iconColor: 'text-teal-600 group-hover:text-white',
  },
  {
    id: 'pdf_to_txt',
    name: 'PDF to TEXT',
    description: 'Extract clean raw UTF-8 text from any PDF document with instant structural coordinate alignment.',
    category: 'convert_from',
    operation: 'pdf_to_txt',
    accepts: '.pdf',
    badge: 'Fast',
    icon: FileText,
    iconBg: 'bg-slate-100 group-hover:bg-slate-700',
    iconColor: 'text-slate-700 group-hover:text-white',
  },

  // PDF Security
  {
    id: 'pdf_encrypt',
    name: 'Protect PDF',
    description: 'Encrypt your PDF with robust military-grade AES-256 password protection to prevent unauthorized access.',
    category: 'security',
    operation: 'pdf_encrypt',
    accepts: '.pdf',
    badge: 'AES-256',
    icon: Lock,
    iconBg: 'bg-rose-50 group-hover:bg-rose-600',
    iconColor: 'text-[#E5322D] group-hover:text-white',
  },
  {
    id: 'pdf_decrypt',
    name: 'Unlock PDF',
    description: 'Remove PDF password security and permissions restrictions so you can freely edit, print, or view.',
    category: 'security',
    operation: 'pdf_decrypt',
    accepts: '.pdf',
    badge: 'Decrypt',
    icon: Unlock,
    iconBg: 'bg-slate-100 group-hover:bg-slate-800',
    iconColor: 'text-slate-800 group-hover:text-white',
  },

  // Image Utilities
  {
    id: 'png_to_webp',
    name: 'PNG to WebP',
    description: 'Convert large PNG images into next-gen lightweight WebP files saving up to 80% bandwidth.',
    category: 'image',
    operation: 'png_to_webp',
    accepts: '.png',
    badge: 'Next-Gen',
    icon: ImageIcon,
    iconBg: 'bg-teal-50 group-hover:bg-teal-600',
    iconColor: 'text-teal-600 group-hover:text-white',
  },
  {
    id: 'jpg_to_webp',
    name: 'JPG to WebP',
    description: 'Convert JPEG photos into modern WebP with superior lossless and lossy compression.',
    category: 'image',
    operation: 'jpg_to_webp',
    accepts: '.jpg,.jpeg',
    badge: 'WebP',
    icon: ImageIcon,
    iconBg: 'bg-emerald-50 group-hover:bg-emerald-600',
    iconColor: 'text-emerald-600 group-hover:text-white',
  },
  {
    id: 'image_resize',
    name: 'Resize Image',
    description: 'Rescale photos to custom dimensions with Catmull-Rom high-fidelity image filtering.',
    category: 'image',
    operation: 'image_resize',
    accepts: '.jpg,.jpeg,.png,.webp',
    badge: 'Lanczos',
    icon: ImageIcon,
    iconBg: 'bg-indigo-50 group-hover:bg-indigo-600',
    iconColor: 'text-indigo-600 group-hover:text-white',
  },
  {
    id: 'image_to_searchable_pdf',
    name: 'Image to OCR PDF',
    description: 'Perform OCR on photos and receipts to create searchable PDF files with selectable text.',
    category: 'image',
    operation: 'image_to_searchable_pdf',
    accepts: '.png,.jpg,.jpeg',
    badge: 'OCR',
    icon: FileCheck2,
    iconBg: 'bg-violet-50 group-hover:bg-violet-600',
    iconColor: 'text-violet-600 group-hover:text-white',
  },
];

export default function HomePage() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [initialOp, setInitialOp] = useState<string | undefined>(undefined);
  const [step, setStep] = useState<Step>('idle');
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<JobDetailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingTool, setPendingTool] = useState<ToolItem | null>(null);

  useEffect(() => {
    fetchCapabilities().then((caps) => {
      if (caps.length > 0) setCapabilities(caps);
    });

    // Custom event listeners for header navigation integration
    const onToolSelect = (e: any) => {
      const { operation, accepts } = e.detail;
      const matchedTool = TOOLS_CATALOG.find((t) => t.operation === operation);
      setPendingTool(matchedTool || null);
      if (fileInputRef.current) {
        fileInputRef.current.accept = accepts || '*/*';
        fileInputRef.current.click();
      }
    };

    const onCategorySelect = (e: any) => {
      const cat = e.detail.category as CategoryTab;
      setActiveTab(cat);
    };

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'organize') setActiveTab('organize');
      else if (hash === 'optimize') setActiveTab('optimize');
      else if (hash === 'convert-to-pdf') setActiveTab('convert_to');
      else if (hash === 'convert-from-pdf') setActiveTab('convert_from');
      else if (hash === 'security') setActiveTab('security');
      else if (hash === 'image-tools') setActiveTab('image');
    };

    window.addEventListener('lipdf:select_tool', onToolSelect);
    window.addEventListener('lipdf:select_category', onCategorySelect);
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener('lipdf:select_tool', onToolSelect);
      window.removeEventListener('lipdf:select_category', onCategorySelect);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleFileSelected = (file: File, preselectedOp?: string) => {
    setSelectedFile(file);
    setInitialOp(preselectedOp);
    setStep('configuring');
    setErrorMessage(null);
  };

  const handleToolCardClick = (tool: ToolItem) => {
    setPendingTool(tool);
    if (fileInputRef.current) {
      fileInputRef.current.accept = tool.accepts;
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileSelected(file, pendingTool?.operation);
      e.target.value = '';
    }
  };

  const handleStartJob = async (operation: string, parameters: Record<string, any>) => {
    if (!selectedFile) return;

    try {
      setStep('uploading');
      setUploadPercent(10);

      // 1. Request presigned upload slot
      const presign = await requestPresignedUpload(selectedFile);
      setUploadPercent(30);

      // 2. Direct-to-storage stream upload
      await uploadFileToPresigned(presign.upload_url, selectedFile, (pct) => {
        setUploadPercent(30 + Math.round(pct * 0.4)); // 30% to 70%
      });
      setUploadPercent(80);

      // 3. Dispatch Job with Idempotency Key
      const idempotencyKey = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const jobRes = await createJob(presign.upload_id, operation, parameters, idempotencyKey);

      setActiveJobId(jobRes.job_id);
      setStep('processing');
    } catch (err: any) {
      console.error('Job initiation error:', err);
      setErrorMessage(err.message || 'Failed to process file');
      setStep('failed');
    }
  };

  const handleJobComplete = async () => {
    if (!activeJobId) return;
    try {
      const details = await fetchJobDetails(activeJobId);
      setJobData(details);
      setStep('completed');
    } catch (err: any) {
      setErrorMessage('Failed to fetch completed job details');
      setStep('failed');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setInitialOp(undefined);
    setActiveJobId(null);
    setJobData(null);
    setErrorMessage(null);
    setStep('idle');
    setUploadPercent(0);
  };

  const filteredTools = TOOLS_CATALOG.filter((tool) => {
    if (activeTab === 'all') return true;
    return tool.category === activeTab;
  });

  return (
    <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full flex flex-col justify-between">
      {/* Hidden input for direct tool card clicks */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div>
        {/* iLovePDF-style Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-10 sm:mb-14">
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight sm:leading-tight">
            Every tool you need to work with PDFs in one place
          </h1>
          <p className="mt-4 text-base sm:text-xl text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Every tool you need to use PDFs, at your fingertips. All are 100% free and easy to use! Merge, split, compress, convert, rotate, unlock and OCR PDFs with just a few clicks.
          </p>
        </div>

        {/* Interactive Workspace Area */}
        <div className="max-w-4xl mx-auto mb-16">
          {step === 'idle' && (
            <Dropzone onFileSelected={(f) => handleFileSelected(f)} />
          )}

          {step === 'configuring' && selectedFile && (
            <CapabilitiesSelector
              file={selectedFile}
              capabilities={capabilities}
              initialOperation={initialOp}
              onStartJob={handleStartJob}
              onReset={handleReset}
            />
          )}

          {step === 'uploading' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 sm:p-14 text-center shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Uploading Document...
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Direct-to-storage stream upload in progress.
              </p>
              <div className="w-full bg-slate-100 rounded-full h-3 max-w-md mx-auto overflow-hidden">
                <div
                  className="bg-[#E5322D] h-full rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-500 mt-3 block">{uploadPercent}%</span>
            </div>
          )}

          {step === 'processing' && activeJobId && (
            <JobProgress
              jobId={activeJobId}
              onComplete={handleJobComplete}
              onError={(msg) => {
                setErrorMessage(msg);
                setStep('failed');
              }}
            />
          )}

          {step === 'completed' && jobData && selectedFile && (
            <ResultCard
              jobData={jobData}
              originalFile={selectedFile}
              onReset={handleReset}
            />
          )}

          {step === 'failed' && (
            <div className="bg-white border border-red-200 rounded-3xl p-10 text-center shadow-sm">
              <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                ✕
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Processing Error</h3>
              <p className="text-sm text-red-600 mb-6">{errorMessage || 'An error occurred during conversion.'}</p>
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Category Filter Tabs & Tool Grid */}
        {step === 'idle' && (
          <div className="mt-8 pt-10 border-t border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  All PDF & Document Tools
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Select a tool below to quickly convert, optimize, or secure your files.
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl overflow-x-auto max-w-full">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'organize', label: 'Organize PDF' },
                  { id: 'optimize', label: 'Optimize PDF' },
                  { id: 'convert_to', label: 'Convert to PDF' },
                  { id: 'convert_from', label: 'Convert from PDF' },
                  { id: 'security', label: 'PDF Security' },
                  { id: 'image', label: 'Image Tools' },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as CategoryTab)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-white text-[#E5322D] shadow-xs ring-1 ring-slate-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid of Tool Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredTools.map((tool) => {
                const IconComponent = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolCardClick(tool)}
                    className="group text-left p-6 rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 rounded-2xl ${tool.iconBg} ${tool.iconColor} flex items-center justify-center transition-colors shadow-xs`}>
                          <IconComponent className="w-6 h-6" />
                        </div>
                        {tool.badge && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-lg mb-1.5 group-hover:text-[#E5322D] transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                        {tool.description}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#E5322D] transition-colors">
                      <span>{tool.accepts}</span>
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Trust & Guarantee Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 pt-12 border-t border-slate-200/80">
        <div className="p-6 rounded-2xl bg-white/70 border border-slate-200/70 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-[#E5322D] flex items-center justify-center mb-3 font-semibold">
            <Lock className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 text-sm mb-1">Hostile Sandbox Isolation</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            All conversions run in non-root sandboxed worker processes with memory limits and isolated scratch spaces.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/70 border border-slate-200/70 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 font-semibold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 text-sm mb-1">Zero Data Retention</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Uploaded and converted files are permanently deleted after 1 hour by our automated background purger.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/70 border border-slate-200/70 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 text-sm mb-1">Output Validator Gate</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Every output is validated for page count, visual integrity, and corruption before delivery to the client.
          </p>
        </div>
      </div>
    </div>
  );
}
