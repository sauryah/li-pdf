'use client';

import React from 'react';
import { ShieldCheck, X, Trash2, Lock, EyeOff } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Privacy & Security Pledge</h3>
            <p className="text-xs text-slate-500">Your biometric photos are 100% ephemeral</p>
          </div>
        </div>

        <div className="mt-4 space-y-3.5 text-xs text-slate-600">
          <div className="flex items-start gap-2.5">
            <Trash2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <p>
              <strong className="text-slate-900">Automatic Deletion: </strong>
              All uploaded photos and generated files are automatically deleted after 15 minutes or immediately upon session completion.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <p>
              <strong className="text-slate-900">No Permanent Storage: </strong>
              We do not store your images in any database or training dataset.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <EyeOff className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <p>
              <strong className="text-slate-900">Zero AI Training: </strong>
              Your images are processed purely through local deterministic computer vision routines and are never used to train machine learning models.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
