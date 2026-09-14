'use client';

import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Analyzing question...',
}) => {
  return (
    <div className="w-full max-w-md mx-auto p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col items-center justify-center space-y-4 text-center">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center animate-pulse">
          <Sparkles className="w-8 h-8 text-blue-400" />
        </div>
        <Loader2 className="absolute -inset-2 w-20 h-20 text-blue-500 animate-spin opacity-40" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-100">{message}</h3>
        <p className="text-xs text-slate-400">
          Gemini Vision is reading your image and identifying the correct option.
        </p>
      </div>
    </div>
  );
};
