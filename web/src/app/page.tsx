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
  Cpu,
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
} from 'lucide-react';

type Step = 'idle' | 'configuring' | 'uploading' | 'processing' | 'completed' | 'failed';
type CategoryTab = 'all' | 'pdf' | 'image' | 'compression' | 'office' | 'security';

interface ToolItem {
  id: string;
  name: string;
  description: string;
  category: 'pdf' | 'image' | 'compression' | 'office' | 'security';
  operation: string;
  accepts: string;
  badge: string;
  icon: any;
}

const TOOLS_CATALOG: ToolItem[] = [
  // PDF Tools
  {
    id: 'pdf_compress',
    name: 'Compress PDF',
    description: 'Reduce PDF file size with lossless Flate stream deduplication or balanced DPI downsampling.',
    category: 'pdf',
    operation: 'pdf_compress',
    accepts: '.pdf',
    badge: 'Fast',
    icon: Minimize2,
  },
  {
    id: 'pdf_to_jpg',
    name: 'PDF to JPG',
    description: 'Extract every page of a PDF document as high-DPI crisp JPEG raster images.',
    category: 'pdf',
    operation: 'pdf_to_jpg',
    accepts: '.pdf',
    badge: '300 DPI',
    icon: ImageIcon,
  },
  {
    id: 'pdf_to_png',
    name: 'PDF to PNG',
    description: 'Convert PDF pages into lossless transparent PNG graphics.',
    category: 'pdf',
    operation: 'pdf_to_png',
    accepts: '.pdf',
    badge: 'Lossless',
    icon: ImageIcon,
  },
  {
    id: 'pdf_rotate',
    name: 'Rotate PDF',
    description: 'Permanently rotate PDF orientation by 90°, 180°, or 270° clockwise.',
    category: 'pdf',
    operation: 'pdf_rotate',
    accepts: '.pdf',
    badge: 'Layout',
    icon: RotateCw,
  },
  {
    id: 'pdf_to_docx',
    name: 'PDF to Word (DOCX)',
    description: 'Reflow and reconstruct PDF layout into editable OpenXML Microsoft Word document.',
    category: 'pdf',
    operation: 'pdf_to_docx',
    accepts: '.pdf',
    badge: 'Editable',
    icon: FileText,
  },
  {
    id: 'pdf_to_txt',
    name: 'PDF to Text',
    description: 'Extract plain UTF-8 text with strict structural coordinate preservation.',
    category: 'pdf',
    operation: 'pdf_to_txt',
    accepts: '.pdf',
    badge: 'Instant',
    icon: FileText,
  },
  {
    id: 'pdf_to_html',
    name: 'PDF to HTML',
    description: 'Convert PDF document into web-ready vector XHTML/HTML pages.',
    category: 'pdf',
    operation: 'pdf_to_html',
    accepts: '.pdf',
    badge: 'Web Ready',
    icon: FileCode,
  },

  // Image Utilities
  {
    id: 'png_to_webp',
    name: 'PNG to WebP',
    description: 'Convert heavy PNG images to ultra-lightweight WebP format (saving up to 80% bandwidth).',
    category: 'image',
    operation: 'png_to_webp',
    accepts: '.png',
    badge: 'Next-Gen',
    icon: ImageIcon,
  },
  {
    id: 'jpg_to_webp',
    name: 'JPG to WebP',
    description: 'Convert JPEG photos into optimized modern WebP with lossless or lossy compression.',
    category: 'image',
    operation: 'jpg_to_webp',
    accepts: '.jpg,.jpeg',
    badge: 'WebP',
    icon: ImageIcon,
  },
  {
    id: 'image_resize',
    name: 'Resize Image',
    description: 'Rescale photos to custom dimensions using Catmull-Rom high-fidelity resampling.',
    category: 'image',
    operation: 'image_resize',
    accepts: '.jpg,.jpeg,.png,.webp',
    badge: 'Lanczos',
    icon: ImageIcon,
  },
  {
    id: 'jpg_to_pdf',
    name: 'JPG to PDF',
    description: 'Package one or multiple JPEG photographs into a clean standardized PDF.',
    category: 'image',
    operation: 'jpg_to_pdf',
    accepts: '.jpg,.jpeg',
    badge: 'Packaging',
    icon: FileText,
  },
  {
    id: 'png_to_pdf',
    name: 'PNG to PDF',
    description: 'Convert transparent or solid PNG graphics into a standardized PDF document.',
    category: 'image',
    operation: 'png_to_pdf',
    accepts: '.png',
    badge: 'Packaging',
    icon: FileText,
  },

  // Compression
  {
    id: 'pdf_compress_heavy',
    name: 'PDF Stream Optimizer',
    description: 'Deep QPDF structural stream linearizer and cross-reference table deduplicator.',
    category: 'compression',
    operation: 'pdf_compress',
    accepts: '.pdf',
    badge: 'QPDF',
    icon: Minimize2,
  },
  {
    id: 'image_compress',
    name: 'Image Compressor',
    description: 'Fine-tune JPEG and WebP quantization matrices to dramatically shrink image sizes.',
    category: 'compression',
    operation: 'image_compress',
    accepts: '.jpg,.jpeg,.png',
    badge: 'Optimizer',
    icon: Minimize2,
  },

  // Office & OCR
  {
    id: 'docx_to_pdf',
    name: 'DOCX to PDF',
    description: 'Convert Microsoft Word DOCX documents into pixel-perfect PDF via headless LibreOffice.',
    category: 'office',
    operation: 'docx_to_pdf',
    accepts: '.docx,.doc',
    badge: 'LibreOffice',
    icon: FileText,
  },
  {
    id: 'xlsx_to_pdf',
    name: 'Excel to PDF',
    description: 'Convert Microsoft Excel spreadsheets (.xlsx, .xls) into printable PDF tables.',
    category: 'office',
    operation: 'xlsx_to_pdf',
    accepts: '.xlsx,.xls',
    badge: 'Sheets',
    icon: FileSpreadsheet,
  },
  {
    id: 'pptx_to_pdf',
    name: 'PowerPoint to PDF',
    description: 'Convert Microsoft PowerPoint presentations (.pptx, .ppt) into vector PDF slide decks.',
    category: 'office',
    operation: 'pptx_to_pdf',
    accepts: '.pptx,.ppt',
    badge: 'Slides',
    icon: Layers,
  },
  {
    id: 'pdf_ocr',
    name: 'Scanned PDF to Searchable PDF',
    description: 'Tesseract 5 OCR layer synthesis. Injects an invisible searchable text layer over scans.',
    category: 'office',
    operation: 'pdf_ocr',
    accepts: '.pdf',
    badge: 'OCR 5.0',
    icon: FileCheck2,
  },
  {
    id: 'image_to_searchable_pdf',
    name: 'Image to Searchable PDF (OCR)',
    description: 'Run OCR on photos or document snapshots and produce searchable PDFs with selectable text.',
    category: 'office',
    operation: 'image_to_searchable_pdf',
    accepts: '.png,.jpg,.jpeg',
    badge: 'OCR Layer',
    icon: FileCheck2,
  },
  {
    id: 'image_to_txt',
    name: 'Image OCR Text Extractor',
    description: 'Extract raw recognized text from invoices, receipts, and photos directly to text.',
    category: 'office',
    operation: 'image_to_txt',
    accepts: '.png,.jpg,.jpeg',
    badge: 'Text Layer',
    icon: FileText,
  },

  // Privacy & Security
  {
    id: 'pdf_encrypt',
    name: 'Protect PDF (AES-256)',
    description: 'Lock your sensitive PDF with military-grade AES-256 password encryption and permission flags.',
    category: 'security',
    operation: 'pdf_encrypt',
    accepts: '.pdf',
    badge: 'AES-256',
    icon: Lock,
  },
  {
    id: 'pdf_decrypt',
    name: 'Unlock PDF',
    description: 'Decrypt and remove password restrictions from password-protected PDF files.',
    category: 'security',
    operation: 'pdf_decrypt',
    accepts: '.pdf',
    badge: 'Decrypt',
    icon: Lock,
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

    // Listen to hash changes in URL (e.g. from navbar clicks)
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'pdf-tools') setActiveTab('pdf');
      else if (hash === 'image-tools') setActiveTab('image');
      else if (hash === 'compression') setActiveTab('compression');
      else if (hash === 'security') setActiveTab('security');
      else if (hash === 'office-ocr') setActiveTab('office');
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
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
    <div className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full flex flex-col justify-between">
      {/* Hidden input for direct tool card clicks */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div>
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold mb-5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Zero Data Retention • Deterministic High Fidelity • 33+ Tools</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Universal Document & Image Engine
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Convert, compress, rotate, protect, and OCR your files with isolated workers and 1-hour automated ephemeral storage cleanup.
          </p>
        </div>

        {/* Interactive Workspace Area */}
        <div className="max-w-3xl mx-auto">
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
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Uploading Directly to Storage...
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Streaming payload directly to local storage / S3 without server buffering.
              </p>
              <div className="w-full bg-slate-100 rounded-full h-3 max-w-md mx-auto overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-400 mt-2 block">{uploadPercent}%</span>
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
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                ✕
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Processing Error</h3>
              <p className="text-sm text-red-600 mb-6">{errorMessage || 'An error occurred during conversion.'}</p>
              <button
                onClick={handleReset}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Category Filter Tabs & Tool Catalog */}
        {step === 'idle' && (
          <div className="mt-16 pt-12 border-t border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Explore Platform Capabilities
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Click any tool below to upload your file and begin conversion immediately.
                </p>
              </div>

              {/* Interactive Category Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl overflow-x-auto">
                {[
                  { id: 'all', label: 'All Tools' },
                  { id: 'pdf', label: 'PDF Tools', href: '#pdf-tools' },
                  { id: 'image', label: 'Image Utilities', href: '#image-tools' },
                  { id: 'compression', label: 'Compression', href: '#compression' },
                  { id: 'office', label: 'Office & OCR', href: '#office-ocr' },
                  { id: 'security', label: 'Privacy & Security', href: '#security' },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as CategoryTab);
                        if (tab.href) {
                          window.location.hash = tab.href;
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200'
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTools.map((tool) => {
                const IconComponent = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolCardClick(tool)}
                    className="group text-left p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center transition-colors">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {tool.badge}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 group-hover:text-blue-600 text-base mb-1 transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
                      <span>Accepts {tool.accepts}</span>
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Feature Pillar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 pt-12 border-t border-slate-200/80">
        <div id="security" className="p-6 rounded-2xl bg-white/60 border border-slate-200/60 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 font-semibold">
            <Lock className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 mb-1">Hostile Input Isolation</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            All binary conversions run in non-root, network-isolated sandboxes with restricted cgroups.
          </p>
        </div>

        <div id="compression" className="p-6 rounded-2xl bg-white/60 border border-slate-200/60 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 font-semibold">
            <Zap className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 mb-1">Selective Compression</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Classifies embedded images before recompression to protect 1-bit text masks, CCITT/JBIG2, and CMYK color profiles.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/60 border border-slate-200/60 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 mb-1">Output Validator Gate</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Strict automated parseability, page-count, and non-blank integrity validation before delivery.
          </p>
        </div>
      </div>
    </div>
  );
}
