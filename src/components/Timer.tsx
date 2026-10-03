import React, { useEffect, useState, useRef } from 'react';
import { Clock } from 'lucide-react';

interface TimerProps {
  deadline: number | null;
  getServerNow: () => number;
  maxSeconds?: number;
  onUrgentTick?: (sec: number) => void;
  onExpire?: () => void;
  variant?: 'game' | 'setup';
}

export const Timer: React.FC<TimerProps> = ({
  deadline,
  getServerNow,
  maxSeconds = 15,
  onUrgentTick,
  onExpire,
  variant = 'game',
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(maxSeconds);
  const lastTickedSecondRef = useRef<number | null>(null);
  const expiredFiredRef = useRef<boolean>(false);

  useEffect(() => {
    lastTickedSecondRef.current = null;
    expiredFiredRef.current = false;

    if (!deadline) {
      setSecondsLeft(maxSeconds);
      return;
    }

    const updateTimer = () => {
      const now = getServerNow();
      const diffMs = Math.max(0, deadline - now);
      const sec = Math.ceil(diffMs / 1000);
      setSecondsLeft(sec);

      if (sec <= 5 && sec >= 1 && lastTickedSecondRef.current !== sec) {
        lastTickedSecondRef.current = sec;
        onUrgentTick?.(sec);
      }

      if (diffMs <= 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onExpire?.();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 200);
    return () => clearInterval(interval);
  }, [deadline, getServerNow, maxSeconds, onUrgentTick, onExpire]);

  const isOrange = secondsLeft < 8 && secondsLeft >= 5;
  const isRed = secondsLeft < 5;

  if (variant === 'setup') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border-2 font-display font-bold text-sm tactile-cell transition-colors ${
          isRed
            ? 'bg-rose-500 text-white border-rose-700 animate-pulse'
            : isOrange
            ? 'bg-amber-500 text-white border-amber-700'
            : 'bg-white text-slate-800 border-slate-800'
        }`}
      >
        <Clock className="w-4 h-4 shrink-0" />
        <span className="font-mono-code">{secondsLeft}s</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start select-none">
      <span className="text-[11px] font-bold text-slate-500 tracking-wide mb-1 ml-1">
        Timer
      </span>
      <div
        className={`min-w-[64px] h-[52px] px-2.5 rounded-2xl border-[3px] flex items-center justify-center gap-1 tactile-cell transition-colors duration-150 ${
          isRed
            ? 'bg-rose-500 border-rose-800 text-white animate-pulse'
            : isOrange
            ? 'bg-orange-500 border-orange-800 text-white'
            : 'bg-white border-slate-800 text-slate-900'
        }`}
      >
        <span className="font-display font-bold text-2xl font-mono-code leading-none">
          {secondsLeft}
        </span>
        <span className="text-xs font-bold opacity-80">s</span>
      </div>
    </div>
  );
};
