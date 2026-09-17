'use client';

import React, { useState } from 'react';
import { CameraView } from '@/app/components/CameraView';
import { ImagePreview } from '@/app/components/ImagePreview';
import { AnswerCard } from '@/app/components/AnswerCard';
import { LoadingState } from '@/app/components/LoadingState';
import { RateLimitTimer } from '@/app/components/RateLimitTimer';
import { AppState, MCQAnswer, SolveApiResponse } from '@/lib/types';
import { Brain, AlertCircle, RefreshCw } from 'lucide-react';

export default function HomePage() {
  const [appState, setAppState] = useState<AppState>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [solution, setSolution] = useState<MCQAnswer | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Send solve request to /api/solve
  const sendSolveRequest = async (imageDataUrl: string) => {
    const totalStart = Date.now();
    setAppState('solving');
    setErrorMessage(null);

    try {
      const uploadStart = Date.now();
      const response = await fetch('/api/solve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      const networkMs = Date.now() - uploadStart;
      const data: SolveApiResponse & { serverTimeMs?: number; geminiTimeMs?: number } = await response.json();

      if (!response.ok || !data.success) {
        const errorText =
          data.success === false
            ? data.error
            : 'Unable to solve this question right now. Please check your Gemini API key and try again.';

        if (data.success === false && data.retryAfter) {
          setCooldownSeconds(data.retryAfter);
        }

        setErrorMessage(errorText);
        setAppState('error');
        return;
      }

      const renderStart = Date.now();
      setSolution({
        question: data.question,
        options: data.options,
        answer: data.answer,
        answerText: data.answerText,
        explanation: data.explanation,
        confidence: data.confidence,
      });

      setAppState('result');
      const totalMs = Date.now() - totalStart;
      const frontendRenderMs = Date.now() - renderStart;

      console.log(
        `[PERF BENCHMARK]\n` +
        `├─ Network Upload & Server: ${networkMs}ms\n` +
        `├─ Gemini Engine Generation: ${data.geminiTimeMs || 'N/A'}ms\n` +
        `├─ Frontend Render: ${frontendRenderMs}ms\n` +
        `└─ TOTAL LATENCY: ${totalMs}ms`
      );
    } catch (err: unknown) {
      console.error('Solve request error:', err);
      setErrorMessage(
        'Internet connection unavailable or server error. Please check your connection and try again.'
      );
      setAppState('error');
    }
  };

  // Handle captured or uploaded photo from CameraView
  const handleCapture = (imageDataUrl: string, autoSolve = true) => {
    setCapturedImage(imageDataUrl);
    setErrorMessage(null);

    if (autoSolve) {
      sendSolveRequest(imageDataUrl);
    } else {
      setAppState('preview');
    }
  };

  // Handle retake / try again action
  const handleRetake = () => {
    setCapturedImage(null);
    setSolution(null);
    setErrorMessage(null);
    setAppState('camera');
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-between p-4 sm:p-6 max-w-md mx-auto w-full">
      {/* Header */}
      <header className="w-full text-center space-y-1 py-3">
        <div className="inline-flex items-center space-x-2 bg-blue-950/60 border border-blue-800/60 px-3.5 py-1 rounded-full text-blue-300 text-xs font-semibold tracking-wide">
          <Brain className="w-4 h-4 text-blue-400" />
          <span>AI MCQ SOLVER</span>
        </div>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">
          Auto Camera MCQ Solver
        </h1>
        <p className="text-xs text-slate-400">
          Position your MCQ inside frame • Auto-captures in 15 seconds
        </p>
      </header>

      {/* Active Cooldown Timer */}
      {cooldownSeconds > 0 && (
        <div className="w-full my-2">
          <RateLimitTimer
            initialSeconds={cooldownSeconds}
            onTimerComplete={() => setCooldownSeconds(0)}
          />
        </div>
      )}

      {/* Main Content Area based on state */}
      <div className="w-full flex-1 flex items-center justify-center py-2">
        {appState === 'camera' && (
          <CameraView
            onCapture={handleCapture}
            onError={(msg) => {
              setErrorMessage(msg);
              setAppState('error');
            }}
            autoCaptureSeconds={15}
          />
        )}

        {appState === 'preview' && capturedImage && (
          <ImagePreview
            imageSrc={capturedImage}
            onRetake={handleRetake}
            onSolve={() => sendSolveRequest(capturedImage)}
          />
        )}

        {appState === 'solving' && <LoadingState message="Analyzing & solving question..." />}

        {appState === 'result' && solution && (
          <AnswerCard result={solution} onSolveAnother={handleRetake} autoReturnSeconds={10} />
        )}

        {appState === 'error' && (
          <div className="w-full bg-slate-900 border border-rose-900/60 p-6 rounded-2xl text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-slate-100">Unable to solve</h3>
              <p className="text-xs text-rose-300/90 leading-relaxed font-medium bg-rose-950/50 p-3 rounded-xl border border-rose-900/50">
                {errorMessage || 'An unexpected error occurred.'}
              </p>
            </div>
            <button
              onClick={handleRetake}
              type="button"
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 text-sm font-semibold rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <span>Try Again</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <footer className="w-full text-center py-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-center space-x-2">
          <span>Auto-capture 15s</span>
          <span>•</span>
          <span>Auto-next 10s</span>
          <span>•</span>
          <span>Unlimited practice</span>
        </div>
        <p className="text-[10px] text-slate-400">
          Powered by Gemini Vision API • Answers are AI generated recommendations
        </p>
      </footer>
    </main>
  );
}
