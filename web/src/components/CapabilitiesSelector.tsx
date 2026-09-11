'use client';

import React, { useState } from 'react';
import { Capability } from '../lib/api';
import {
  Settings2,
  ArrowRight,
  FileCheck2,
  Cpu,
  Lock,
  Unlock,
  RotateCw,
  Scaling,
  Sliders,
  Trash2,
  CheckCircle2,
  FileText,
} from 'lucide-react';

interface CapabilitiesSelectorProps {
  file: File;
  capabilities: Capability[];
  initialOperation?: string;
  onStartJob: (operation: string, parameters: Record<string, any>) => void;
  onReset: () => void;
}

export function CapabilitiesSelector({
  file,
  capabilities,
  initialOperation,
  onStartJob,
  onReset,
}: CapabilitiesSelectorProps) {
  const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');

  // Filter relevant capabilities based on file
  const relevantCaps = capabilities.filter((c) => {
    if (isPDF) return c.source_ext === 'pdf';
    return c.source_mime === file.type || file.name.endsWith(c.source_ext);
  });

  const [selectedOp, setSelectedOp] = useState<string>(
    initialOperation && relevantCaps.some((c) => c.operation === initialOperation)
      ? initialOperation
      : relevantCaps.length > 0
      ? relevantCaps[0].operation
      : isPDF
      ? 'pdf_compress'
      : 'png_to_webp'
  );
  const [qualityPreset, setQualityPreset] = useState<string>('balanced');
  const [jpegQuality, setJpegQuality] = useState<number>(80);
  const [dpi, setDpi] = useState<number>(150);
  const [rotationAngle, setRotationAngle] = useState<number>(90);
  const [password, setPassword] = useState<string>('');
  const [resizeW, setResizeW] = useState<number>(1200);
  const [resizeH, setResizeH] = useState<number>(800);
  const [ocrLang, setOcrLang] = useState<string>('eng');

  const currentCap = capabilities.find((c) => c.operation === selectedOp);

  const handleSubmit = () => {
    const params: Record<string, any> = {};
    if (selectedOp === 'pdf_compress') {
      params.preset = qualityPreset;
      params.downsample_dpi = qualityPreset === 'maximum_compression' ? 96 : 150;
      params.jpeg_quality = qualityPreset === 'maximum_compression' ? 60 : 78;
    } else if (selectedOp === 'pdf_rotate') {
      params.angle = rotationAngle;
    } else if (selectedOp === 'pdf_encrypt') {
      params.user_password = password || 'protected123';
    } else if (selectedOp === 'pdf_decrypt') {
      params.password = password || 'protected123';
    } else if (selectedOp === 'image_resize') {
      params.width = resizeW;
      params.height = resizeH;
    } else if (selectedOp.includes('jpg') || selectedOp.includes('compress')) {
      params.quality = jpegQuality;
    } else if (selectedOp === 'pdf_ocr' || selectedOp === 'image_to_txt' || selectedOp === 'image_to_searchable_pdf') {
      params.language = ocrLang;
    }
    if (selectedOp.startsWith('pdf_to_')) {
      params.dpi = dpi;
    }
    onStartJob(selectedOp, params);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full max-w-5xl mx-auto">
      {/* Left Canvas: Document Thumbnail Card */}
      <div className="flex-1 bg-surface-bg border border-slate-200 rounded-3xl p-6 sm:p-8 w-full flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Selected Document
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Ready for isolated processing</p>
          </div>
          <button
            onClick={onReset}
            className="text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center space-x-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove & Change</span>
          </button>
        </div>

        {/* Thumbnail Preview Area */}
        <div className="my-8 flex justify-center">
          <div className="w-56 bg-white rounded-2xl p-5 shadow-tool-card border border-slate-200 text-center relative group">
            <div className="h-48 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center mb-3">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm mb-2 shadow-xs">
                {ext}
              </div>
              <span className="text-xs font-bold text-slate-700 px-2 py-0.5 rounded bg-slate-100">
                {formatFileSize(file.size)}
              </span>
            </div>

            <div className="font-bold text-xs text-slate-900 truncate" title={file.name}>
              {file.name}
            </div>

            {selectedOp === 'pdf_rotate' && (
              <button
                type="button"
                onClick={() => setRotationAngle((prev) => (prev + 90) % 360 || 360)}
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md hover:bg-red-700 transition-colors"
                title="Rotate +90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Available Operations Picker */}
        <div className="pt-4 border-t border-slate-200/80">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
            Switch Target Operation
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {relevantCaps.map((cap) => {
              const isSelected = selectedOp === cap.operation;
              return (
                <button
                  key={cap.operation}
                  onClick={() => setSelectedOp(cap.operation)}
                  className={`text-left p-3 rounded-xl border text-xs font-semibold transition-all ${
                    isSelected
                      ? 'border-red-600 bg-red-50/60 text-red-700 shadow-xs ring-1 ring-red-500/30'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="truncate capitalize">{cap.operation.replace(/_/g, ' ')}</div>
                  <div className="text-[10px] text-slate-400 font-normal uppercase mt-0.5">{cap.target_ext}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Sidebar: Options Configurator */}
      <div className="w-full lg:w-[380px] bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 mb-5">
            <Sliders className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
              {selectedOp.replace(/_/g, ' ')} Options
            </h3>
          </div>

          {/* Compression Presets */}
          {selectedOp === 'pdf_compress' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Compression Level
              </label>
              {[
                { id: 'maximum_compression', title: 'Extreme Compression', desc: 'Maximum size reduction (96 DPI, Q=60)' },
                { id: 'balanced', title: 'Recommended Compression', desc: 'Optimal quality & file size (150 DPI, Q=78)' },
                { id: 'maximum_quality', title: 'Less Compression', desc: 'Highest visual quality (Lossless Flate)' },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setQualityPreset(opt.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    qualityPreset === opt.id
                      ? 'border-red-600 bg-red-50/40 ring-1 ring-red-500/30'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{opt.title}</span>
                    {qualityPreset === opt.id && <CheckCircle2 className="w-4 h-4 text-red-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* Rotation Angle */}
          {selectedOp === 'pdf_rotate' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Rotation Orientation
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => setRotationAngle(deg)}
                    className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                      rotationAngle === deg
                        ? 'border-red-600 bg-red-50 text-red-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    +{deg}°
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Password Protection */}
          {(selectedOp === 'pdf_encrypt' || selectedOp === 'pdf_decrypt') && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {selectedOp === 'pdf_encrypt' ? 'Set AES-256 Passphrase' : 'Enter Password to Decrypt'}
              </label>
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          )}

          {/* OCR Language */}
          {(selectedOp === 'pdf_ocr' || selectedOp === 'image_to_txt' || selectedOp === 'image_to_searchable_pdf') && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                OCR Recognition Language
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { code: 'eng', name: 'English (Tesseract 5)' },
                  { code: 'spa', name: 'Spanish (Español)' },
                  { code: 'fra', name: 'French (Français)' },
                  { code: 'deu', name: 'German (Deutsch)' },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setOcrLang(lang.code)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      ocrLang === lang.code
                        ? 'border-red-600 bg-red-50 text-red-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image Resizing */}
          {selectedOp === 'image_resize' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Target Dimensions
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Width (px)</span>
                  <input
                    type="number"
                    value={resizeW}
                    onChange={(e) => setResizeW(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Height (px)</span>
                  <input
                    type="number"
                    value={resizeH}
                    onChange={(e) => setResizeH(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rasterization DPI */}
          {selectedOp.startsWith('pdf_to_') && (
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Rendering DPI</span>
                <span className="text-red-600">{dpi} DPI</span>
              </div>
              <input
                type="range"
                min="72"
                max="300"
                step="75"
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value))}
                className="w-full accent-red-600"
              />
            </div>
          )}
        </div>

        {/* Big Red Process CTA Button */}
        <div className="mt-8 pt-4 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/25 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
          >
            <span>PROCESS {selectedOp.replace(/_/g, ' ').toUpperCase()}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
