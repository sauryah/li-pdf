'use client';

import React, { useState } from 'react';
import { DocumentSpec } from '../../lib/passport-types';
import { Check, Search } from 'lucide-react';

interface DocumentSelectorProps {
  specs: DocumentSpec[];
  selectedSpecId: string;
  onSelectSpec: (specId: string) => void;
}

export const DocumentSelector: React.FC<DocumentSelectorProps> = ({
  specs,
  selectedSpecId,
  onSelectSpec
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredSpecs = specs.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      activeCategory === 'all' || s.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search country, visa, or document (e.g. India, US, Schengen)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'passport', label: 'Passports' },
            { id: 'visa', label: 'Visas' },
            { id: 'id', label: 'ID Cards' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-[#E5322D] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredSpecs.map((spec) => {
          const isSelected = spec.id === selectedSpecId;
          return (
            <div
              key={spec.id}
              onClick={() => onSelectSpec(spec.id)}
              className={`relative cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                isSelected
                  ? 'border-[#E5322D] bg-red-50/40 shadow-md ring-2 ring-[#E5322D]/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                    {spec.country_code}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">
                      {spec.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {spec.country}
                    </p>
                  </div>
                </div>

                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                    isSelected
                      ? 'border-[#E5322D] bg-[#E5322D] text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                  {spec.width_mm} × {spec.height_mm} mm
                </span>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                  Face: {Math.round(spec.face_coverage_min_pct * 100)}–{Math.round(spec.face_coverage_max_pct * 100)}%
                </span>
                <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
                  {spec.dpi} DPI
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500 line-clamp-2">
                {spec.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
