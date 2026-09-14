'use client';

import React, { useEffect, useState } from 'react';
import { Timer, AlertCircle } from 'lucide-react';

interface RateLimitTimerProps {
  initialSeconds: number;
  onTimerComplete?: () => void;
}

export const RateLimitTimer: React.FC<RateLimitTimerProps> = ({
  initialSeconds,
  onTimerComplete,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (onTimerComplete) onTimerComplete();
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onTimerComplete) onTimerComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft, onTimerComplete]);

  if (secondsLeft <= 0) return null;

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-amber-950/50 border border-amber-800/80 rounded-xl text-amber-200 text-sm flex items-center space-x-3 shadow-lg">
      <Timer className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
      <div className="flex-1">
        <p className="font-semibold text-amber-300">Rate limit active</p>
        <p className="text-xs text-amber-200/80">
          Next question available in{' '}
          <span className="font-bold text-amber-100">{secondsLeft}</span> second
          {secondsLeft > 1 ? 's' : ''}.
        </p>
      </div>
    </div>
  );
};
