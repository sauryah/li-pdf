'use client';

import React from 'react';
import { AdjustRequest, DocumentSpec } from '../../lib/passport-types';
import { RotateCw, ZoomIn, Sun, Contrast, Palette, RefreshCw, Move } from 'lucide-react';

interface ManualAdjustControlsProps {
  adjustState: AdjustRequest;
  spec: DocumentSpec;
  onChange: (newState: Partial<AdjustRequest>) => void;
  onReset: () => void;
  isAdjusting: boolean;
}

export const ManualAdjustControls: React.FC<ManualAdjustControlsProps> = ({
  adjustState,
  spec,
  onChange,
  onReset,
  isAdjusting
}) => {
  const colorSwatches = [
    { name: 'Pure White', hex: '#FFFFFF' },
    { name: 'Light Grey', hex: '#E5E7EB' },
    { name: 'Off-White', hex: '#F9FAFB' },
    { name: 'Light Blue', hex: '#E0F2FE' },
    { name: 'Passport Blue', hex: '#1E3A8A' },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Move className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Manual Fine-Tuning</h3>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={isAdjusting}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3 w-3 ${isAdjusting ? 'animate-spin' : ''}`} />
          <span>Reset AI Crop</span>
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-slate-500" />
            <span>Background Color</span>
          </label>
          <span className="text-[11px] font-mono font-medium text-slate-500 uppercase">
            {adjustState.background_color}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {colorSwatches.map((swatch) => {
            const isSelected =
              adjustState.background_color.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                onClick={() => onChange({ background_color: swatch.hex })}
                className={`group flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600 text-blue-900 shadow-sm'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-slate-300 shadow-inner"
                  style={{ backgroundColor: swatch.hex }}
                />
                <span>{swatch.name}</span>
              </button>
            );
          })}
          <div className="relative flex items-center">
            <input
              type="color"
              value={adjustState.background_color}
              onChange={(e) => onChange({ background_color: e.target.value })}
              className="h-7 w-8 cursor-pointer rounded border border-slate-300 p-0.5 bg-white"
              title="Custom color"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <ZoomIn className="h-3.5 w-3.5 text-slate-500" />
              Zoom
            </span>
            <span className="font-mono text-slate-500">{adjustState.zoom.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.7"
            max="1.8"
            step="0.02"
            value={adjustState.zoom}
            onChange={(e) => onChange({ zoom: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <RotateCw className="h-3.5 w-3.5 text-slate-500" />
              Straighten / Rotate
            </span>
            <span className="font-mono text-slate-500">{adjustState.rotate_deg.toFixed(1)}°</span>
          </div>
          <input
            type="range"
            min="-15"
            max="15"
            step="0.5"
            value={adjustState.rotate_deg}
            onChange={(e) => onChange({ rotate_deg: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-700">Position Up/Down</span>
            <span className="font-mono text-slate-500">{Math.round(adjustState.offset_y_pct * 100)}%</span>
          </div>
          <input
            type="range"
            min="-0.25"
            max="0.25"
            step="0.01"
            value={adjustState.offset_y_pct}
            onChange={(e) => onChange({ offset_y_pct: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-700">Position Left/Right</span>
            <span className="font-mono text-slate-500">{Math.round(adjustState.offset_x_pct * 100)}%</span>
          </div>
          <input
            type="range"
            min="-0.25"
            max="0.25"
            step="0.01"
            value={adjustState.offset_x_pct}
            onChange={(e) => onChange({ offset_x_pct: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Sun className="h-3.5 w-3.5 text-slate-500" />
              Brightness
            </span>
            <span className="font-mono text-slate-500">{adjustState.brightness > 0 ? `+${adjustState.brightness}` : adjustState.brightness}</span>
          </div>
          <input
            type="range"
            min="-30"
            max="30"
            step="1"
            value={adjustState.brightness}
            onChange={(e) => onChange({ brightness: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Contrast className="h-3.5 w-3.5 text-slate-500" />
              Contrast
            </span>
            <span className="font-mono text-slate-500">{adjustState.contrast > 0 ? `+${adjustState.contrast}` : adjustState.contrast}</span>
          </div>
          <input
            type="range"
            min="-30"
            max="30"
            step="1"
            value={adjustState.contrast}
            onChange={(e) => onChange({ contrast: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
