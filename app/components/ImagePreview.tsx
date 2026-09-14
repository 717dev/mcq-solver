'use client';

import React from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';

interface ImagePreviewProps {
  imageSrc: string;
  onRetake: () => void;
  onSolve: () => void;
  isSolving?: boolean;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  imageSrc,
  onRetake,
  onSolve,
  isSolving = false,
}) => {
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto space-y-4">
      {/* Captured Image Display */}
      <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden shadow-xl border border-slate-800 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt="Captured MCQ Preview"
          className="w-full h-full object-contain bg-black/40"
        />
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-xs font-medium text-slate-200">
          Preview
        </div>
      </div>

      {/* Control Buttons */}
      <div className="w-full grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={onRetake}
          disabled={isSolving}
          type="button"
          aria-label="Retake photo"
          className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 font-semibold rounded-xl border border-slate-700 flex items-center justify-center space-x-2 text-sm transition-all disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4 text-slate-400" />
          <span>Retake</span>
        </button>

        <button
          onClick={onSolve}
          disabled={isSolving}
          type="button"
          aria-label="Solve MCQ"
          className="py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 text-sm transition-all disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-blue-200" />
          <span>Solve</span>
        </button>
      </div>
    </div>
  );
};
