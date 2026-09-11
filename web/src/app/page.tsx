'use client';

import React, { useState, useEffect } from 'react';
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
import { ShieldCheck, Zap, Lock, Cpu, Sparkles, CheckCircle2 } from 'lucide-react';

type Step = 'idle' | 'configuring' | 'uploading' | 'processing' | 'completed' | 'failed';

export default function HomePage() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<JobDetailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchCapabilities().then((caps) => {
      if (caps.length > 0) setCapabilities(caps);
    });
  }, []);

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setStep('configuring');
    setErrorMessage(null);
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
    setActiveJobId(null);
    setJobData(null);
    setErrorMessage(null);
    setStep('idle');
    setUploadPercent(0);
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 w-full flex flex-col justify-between">
      <div>
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Zero Data Retention • Deterministic High Fidelity</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Universal Document & Image Engine
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Compress, convert, merge, and split files with sandboxed isolation and strict 1-hour automated ephemeral deletion.
          </p>
        </div>

        {/* Interactive Workspace Card */}
        <div className="max-w-3xl mx-auto">
          {step === 'idle' && (
            <Dropzone onFileSelected={handleFileSelected} />
          )}

          {step === 'configuring' && selectedFile && (
            <CapabilitiesSelector
              file={selectedFile}
              capabilities={capabilities}
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
                Streaming payload directly to Cloudflare R2 / S3 without server buffering.
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
      </div>

      {/* Feature Pillar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 pt-12 border-t border-slate-200/80">
        <div className="p-6 rounded-2xl bg-white/60 border border-slate-200/60 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 font-semibold">
            <Lock className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 mb-1">Hostile Input Isolation</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            All binary conversions run in non-root, network-isolated <code>nsjail</code> sandboxes with restricted cgroups.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/60 border border-slate-200/60 shadow-xs">
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
