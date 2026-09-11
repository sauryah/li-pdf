'use client';

import React, { useState } from 'react';
import { Capability } from '../lib/api';
import { Settings2, ArrowRight, Layers, FileCheck2, Cpu, Lock, Unlock, RotateCw, Scaling } from 'lucide-react';

interface CapabilitiesSelectorProps {
  file: File;
  capabilities: Capability[];
  onStartJob: (operation: string, parameters: Record<string, any>) => void;
  onReset: () => void;
}

export function CapabilitiesSelector({
  file,
  capabilities,
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
    relevantCaps.length > 0 ? relevantCaps[0].operation : isPDF ? 'pdf_compress' : 'png_to_webp'
  );
  const [qualityPreset, setQualityPreset] = useState<string>('balanced');
  const [jpegQuality, setJpegQuality] = useState<number>(80);
  const [dpi, setDpi] = useState<number>(150);
  const [rotationAngle, setRotationAngle] = useState<number>(90);
  const [password, setPassword] = useState<string>('');
  const [resizeW, setResizeW] = useState<number>(1200);
  const [resizeH, setResizeH] = useState<number>(800);

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

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-lg text-slate-900 truncate max-w-md">
              {file.name}
            </span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
              {formatFileSize(file.size)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Preflight check passed. Select target operation below.
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 underline self-start sm:self-auto"
        >
          Change File
        </button>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-semibold text-slate-900 mb-3">
          Available Operations
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {relevantCaps.map((cap) => {
            const isSelected = selectedOp === cap.operation;
            return (
              <button
                key={cap.operation}
                onClick={() => setSelectedOp(cap.operation)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-slate-900 capitalize">
                    {cap.operation.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {cap.target_ext}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {cap.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Options Configurator based on Operation */}
      {selectedOp === 'pdf_compress' && (
        <div className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center space-x-2 mb-3">
            <Settings2 className="w-4 h-4 text-slate-700" />
            <span className="text-sm font-semibold text-slate-900">Compression Preset</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'maximum_quality', label: 'Max Quality', desc: 'Lossless Flate deduplication' },
              { id: 'balanced', label: 'Balanced (Recommended)', desc: '150 DPI downsample, Q=78' },
              { id: 'maximum_compression', label: 'Max Compression', desc: '96 DPI downsample, Q=60' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => setQualityPreset(preset.id)}
                className={`p-3 rounded-xl text-left border text-xs transition-all ${
                  qualityPreset === preset.id
                    ? 'border-blue-600 bg-white shadow-sm font-medium text-blue-900'
                    : 'border-slate-200 bg-white/50 text-slate-600 hover:bg-white'
                }`}
              >
                <div className="font-semibold mb-0.5">{preset.label}</div>
                <div className="text-[11px] text-slate-500">{preset.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedOp === 'pdf_rotate' && (
        <div className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center space-x-2 mb-3">
            <RotateCw className="w-4 h-4 text-slate-700" />
            <span className="text-sm font-semibold text-slate-900">Rotation Angle</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[90, 180, 270].map((angle) => (
              <button
                key={angle}
                onClick={() => setRotationAngle(angle)}
                className={`py-3 px-4 rounded-xl border text-xs font-semibold text-center transition-all ${
                  rotationAngle === angle
                    ? 'border-blue-600 bg-white shadow-sm text-blue-900'
                    : 'border-slate-200 bg-white/50 text-slate-600 hover:bg-white'
                }`}
              >
                +{angle}° Clockwise
              </button>
            ))}
          </div>
        </div>
      )}

      {(selectedOp === 'pdf_encrypt' || selectedOp === 'pdf_decrypt') && (
        <div className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center space-x-2 mb-3">
            {selectedOp === 'pdf_encrypt' ? <Lock className="w-4 h-4 text-slate-700" /> : <Unlock className="w-4 h-4 text-slate-700" />}
            <span className="text-sm font-semibold text-slate-900">
              {selectedOp === 'pdf_encrypt' ? 'Set AES-256 Protection Password' : 'Enter Password to Decrypt'}
            </span>
          </div>
          <input
            type="password"
            placeholder="Enter password..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {selectedOp === 'image_resize' && (
        <div className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center space-x-2 mb-3">
            <Scaling className="w-4 h-4 text-slate-700" />
            <span className="text-sm font-semibold text-slate-900">Custom Dimensions (Pixels)</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Target Width (px)</label>
              <input
                type="number"
                value={resizeW}
                onChange={(e) => setResizeW(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Target Height (px)</label>
              <input
                type="number"
                value={resizeH}
                onChange={(e) => setResizeH(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {selectedOp.startsWith('pdf_to_') && (
        <div className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-900">Rasterization Resolution (DPI)</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">{dpi} DPI</span>
          </div>
          <input
            type="range"
            min="72"
            max="300"
            step="75"
            value={dpi}
            onChange={(e) => setDpi(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>72 DPI (Web Screen)</span>
            <span>150 DPI (Balanced E-Book)</span>
            <span>300 DPI (High-Res Print)</span>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100">
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <Cpu className="w-4 h-4 text-slate-400" />
          <span>Assigned Queue: <strong className="text-slate-700">{currentCap?.queue || 'queue_pdf_std'}</strong></span>
          <span>•</span>
          <span>Profile: <strong className="text-slate-700">{currentCap?.resource_profile || 'PDF_STANDARD'}</strong></span>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-8 py-3.5 rounded-2xl bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          <span>Convert & Process</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
