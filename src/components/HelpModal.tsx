import React from 'react';
import { X, BookOpen, ListChecks, Code2, ExternalLink } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  playClick: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  playClick,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-md max-h-[88dvh] flex flex-col bg-white rounded-3xl border-[3px] border-slate-800 p-5 sm:p-6 tactile-card">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-slate-100 shrink-0">
          <h3 className="font-display font-bold text-2xl text-slate-900">
            How to Play?
          </h3>
          <button
            type="button"
            onClick={() => {
              playClick();
              onClose();
            }}
            aria-label="Close help"
            className="w-10 h-10 rounded-xl border-2 border-slate-800 bg-slate-100 hover:bg-rose-100 text-slate-800 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
          {/* Section 1: About the Game */}
          <div className="p-4 rounded-2xl border-2 border-slate-200 bg-amber-50/70 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-800 font-display font-bold text-base">
              <BookOpen className="w-5 h-5 shrink-0" />
              <span>1. About the Game</span>
            </div>
            <p className="text-sm font-semibold text-slate-700 leading-relaxed">
              Remember drawing a 5×5 box in the back of your notebook to play
              classic number Bingo with school friends? <strong>B.I.N.G.O!</strong> brings
              that pen-and-paper classroom favorite online so you can play in real time
              with friends across any phone or computer using a simple 5-character room code.
            </p>
          </div>

          {/* Section 2: How to Play */}
          <div className="p-4 rounded-2xl border-2 border-slate-200 bg-sky-50/70 space-y-2.5">
            <div className="flex items-center gap-2 text-sky-900 font-display font-bold text-base">
              <ListChecks className="w-5 h-5 shrink-0" />
              <span>2. How to Play</span>
            </div>

            <ol className="space-y-2 text-sm font-semibold text-slate-700 list-decimal list-inside">
              <li>
                <strong>Build Your 5×5 Grid:</strong> Before the match begins, arrange
                numbers <strong>1 to 25</strong> on your secret grid within 45 seconds (tap <em>Shuffle</em> or tap cells manually).
              </li>
              <li>
                <strong>Take Turns Calling Numbers:</strong> Players take turns in order. On your turn, tap any unmarked number on your grid.
              </li>
              <li>
                <strong>15-Second Turn Timer:</strong> Each turn has a 15-second limit. If time runs out, a random number is called automatically.
              </li>
              <li>
                <strong>Marked for Everyone:</strong> Every number called is automatically marked on <em>every</em> player&apos;s grid.
              </li>
              <li>
                <strong>Cross Out B-I-N-G-O:</strong> Complete any of the 12 possible lines (5 rows, 5 columns, 2 diagonals). Each completed line crosses out one letter in order: <strong>B → I → N → G → O</strong>.
              </li>
              <li>
                <strong>Anti-Cheating Privacy:</strong> Opponents cannot see your secret grid or numbers. Only line completion progress is shared!
              </li>
              <li>
                <strong>Winning Rules:</strong> First player to cross all 5 letters wins <strong>1st Place</strong>. In 3–4 player games, play continues for 2nd and 3rd place until only one player remains (the loser).
              </li>
            </ol>
          </div>

          {/* Section 3: About the Developer */}
          <div className="p-4 rounded-2xl border-2 border-slate-200 bg-violet-50/70 space-y-2">
            <div className="flex items-center gap-2 text-violet-900 font-display font-bold text-base">
              <Code2 className="w-5 h-5 shrink-0" />
              <span>3. About the Developer</span>
            </div>

            <p className="font-display font-bold text-sm text-slate-900">
              Created by [ABHI_GAMES]
            </p>
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">
              [Placeholder Bio: Indie game developer crafting fast-paced, joyful multiplayer web games for friends and families.]
            </p>

            <div className="pt-1 flex items-center gap-3 text-xs font-bold text-violet-700">
              <span className="inline-flex items-center gap-1">
                <span>[Social / Portfolio Link]</span>
                <ExternalLink className="w-3 h-3" />
              </span>
              <span>·</span>
              <span>[Contact Email]</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <button
          type="button"
          onClick={() => {
            playClick();
            onClose();
          }}
          className="mt-2 w-full h-12 rounded-2xl border-[2.5px] border-slate-800 bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-display font-bold text-base tactile-btn cursor-pointer shrink-0"
        >
          Got It, Let&apos;s Play!
        </button>
      </div>
    </div>
  );
};
