import React from 'react';

const BINGO_CHARS = ['B', 'I', 'N', 'G', 'O'] as const;

const LETTER_PALETTE = [
  { activeBg: 'bg-rose-500', activeBorder: 'border-rose-700' },
  { activeBg: 'bg-amber-500', activeBorder: 'border-amber-700' },
  { activeBg: 'bg-emerald-500', activeBorder: 'border-emerald-700' },
  { activeBg: 'bg-sky-500', activeBorder: 'border-sky-700' },
  { activeBg: 'bg-violet-500', activeBorder: 'border-violet-700' },
];

interface BingoLettersProps {
  linesCompleted: number;
  compact?: boolean;
}

export const BingoLetters: React.FC<BingoLettersProps> = ({
  linesCompleted,
  compact = false,
}) => {
  const crossedCount = Math.min(5, Math.max(0, linesCompleted));

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 select-none" aria-label={`${crossedCount} of 5 BINGO letters`}>
        {BINGO_CHARS.map((letter, idx) => {
          const isCrossed = idx < crossedCount;
          const colors = LETTER_PALETTE[idx];
          return (
            <div
              key={letter}
              className={`relative w-5 h-5 rounded-md flex items-center justify-center font-display font-bold text-[11px] border transition-colors ${
                isCrossed
                  ? `${colors.activeBg} ${colors.activeBorder} text-white`
                  : 'bg-slate-100 border-slate-300 text-slate-400'
              }`}
            >
              <span>{letter}</span>
              {isCrossed && (
                <svg
                  viewBox="0 0 24 24"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                >
                  <line
                    x1="4"
                    y1="20"
                    x2="20"
                    y2="4"
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center select-none">
      <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 py-1">
        {BINGO_CHARS.map((letter, idx) => {
          const isCrossed = idx < crossedCount;
          const colors = LETTER_PALETTE[idx];

          return (
            <div
              key={letter}
              className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-[3px] flex items-center justify-center font-display font-bold text-2xl sm:text-3xl select-none tactile-cell transition-all duration-150 ${
                isCrossed
                  ? `${colors.activeBg} ${colors.activeBorder} text-white scale-105`
                  : 'bg-white border-slate-800 text-slate-800'
              }`}
            >
              <span>{letter}</span>

              {/* Diagonal strike-through slash */}
              {isCrossed && (
                <svg
                  viewBox="0 0 48 48"
                  className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                >
                  <line
                    x1="7"
                    y1="41"
                    x2="41"
                    y2="7"
                    stroke="#1E293B"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <line
                    x1="7"
                    y1="41"
                    x2="41"
                    y2="7"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
