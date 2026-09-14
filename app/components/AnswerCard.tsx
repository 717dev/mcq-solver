'use client';

import React from 'react';
import { MCQAnswer, ConfidenceLevel } from '@/lib/types';
import { CheckCircle2, AlertTriangle, ArrowRight, HelpCircle } from 'lucide-react';

interface AnswerCardProps {
  result: MCQAnswer;
  onSolveAnother: () => void;
}

const confidenceBadgeStyle: Record<ConfidenceLevel, { bg: string; text: string; label: string; icon: React.FC<{ className?: string }> }> = {
  high: {
    bg: 'bg-emerald-950/80 border-emerald-800 text-emerald-300',
    text: 'text-emerald-400',
    label: 'HIGH CONFIDENCE',
    icon: CheckCircle2,
  },
  medium: {
    bg: 'bg-amber-950/80 border-amber-800 text-amber-300',
    text: 'text-amber-400',
    label: 'MEDIUM CONFIDENCE',
    icon: HelpCircle,
  },
  low: {
    bg: 'bg-rose-950/80 border-rose-800 text-rose-300',
    text: 'text-rose-400',
    label: 'LOW CONFIDENCE',
    icon: AlertTriangle,
  },
};

export const AnswerCard: React.FC<AnswerCardProps> = ({ result, onSolveAnother }) => {
  const confidence = result.confidence || 'medium';
  const style = confidenceBadgeStyle[confidence];
  const IconComponent = style.icon;

  return (
    <div className="w-full max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Top Banner & Confidence Badge */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            MCQ Solver Result
          </span>
          <div className={`px-2.5 py-1 rounded-full border text-[11px] font-bold flex items-center space-x-1 ${style.bg}`}>
            <IconComponent className="w-3.5 h-3.5" />
            <span>{style.label}</span>
          </div>
        </div>

        {/* Correct Answer Highlight Box */}
        <div className="bg-gradient-to-br from-blue-950/60 to-indigo-950/60 border border-blue-800/60 rounded-xl p-5 text-center space-y-2">
          <p className="text-xs uppercase font-semibold text-blue-300 tracking-wider">
            Correct Answer
          </p>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white font-black text-3xl shadow-lg shadow-blue-600/40 my-1">
            {result.answer}
          </div>
          {result.answerText && (
            <p className="text-base font-semibold text-slate-100 px-2 leading-snug">
              Option {result.answer}: {result.answerText}
            </p>
          )}
        </div>

        {/* Extracted Question Text */}
        {result.question && (
          <div className="space-y-1.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <p className="text-xs font-semibold text-slate-400 uppercase">Question</p>
            <p className="text-sm text-slate-200 leading-relaxed">{result.question}</p>
          </div>
        )}

        {/* Options List */}
        {result.options && Object.keys(result.options).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase">All Options</p>
            <div className="space-y-1.5">
              {Object.entries(result.options).map(([key, value]) => {
                const isSelected = key.toUpperCase() === result.answer.toUpperCase();
                return (
                  <div
                    key={key}
                    className={`p-3 rounded-lg border text-sm flex items-start space-x-3 transition-colors ${
                      isSelected
                        ? 'bg-blue-950/50 border-blue-600/80 text-blue-100 font-medium'
                        : 'bg-slate-950/30 border-slate-800/60 text-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {key}
                    </span>
                    <span className="leading-snug pt-0.5">{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Explanation Section */}
        <div className="space-y-1.5 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Explanation
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            {result.explanation}
          </p>
        </div>

        {/* Low Confidence Warning Notice */}
        {confidence === 'low' && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              The captured image might be slightly blurry or ambiguous. If this answer appears incorrect, please try taking a clearer photo.
            </p>
          </div>
        )}
      </div>

      {/* Solve Another Action Button */}
      <button
        onClick={onSolveAnother}
        type="button"
        aria-label="Solve Another Question"
        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 text-base transition-all"
      >
        <span>Solve Another</span>
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};
