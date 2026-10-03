import React, { useState, useEffect } from 'react';
import {
  Settings,
  Volume2,
  VolumeX,
  HelpCircle,
  Plus,
  LogIn,
  ArrowRight,
  AlertCircle,
  X,
} from 'lucide-react';

interface HomeProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (code: string) => Promise<{ ok: boolean; error?: string }>;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  playClick: () => void;
  initialRoomCode?: string;
}

const TITLE_LETTERS = [
  { char: 'B', color: 'text-rose-500' },
  { char: '.', color: 'text-slate-700', isDot: true },
  { char: 'I', color: 'text-amber-500' },
  { char: '.', color: 'text-slate-700', isDot: true },
  { char: 'N', color: 'text-emerald-500' },
  { char: '.', color: 'text-slate-700', isDot: true },
  { char: 'G', color: 'text-sky-500' },
  { char: '.', color: 'text-slate-700', isDot: true },
  { char: 'O', color: 'text-violet-500' },
  { char: '!', color: 'text-rose-500' },
];

export const Home: React.FC<HomeProps> = ({
  playerName,
  onPlayerNameChange,
  onCreateRoom,
  onJoinRoom,
  soundEnabled,
  onToggleSound,
  onOpenSettings,
  onOpenHelp,
  playClick,
  initialRoomCode = '',
}) => {
  const [showJoinBox, setShowJoinBox] = useState<boolean>(Boolean(initialRoomCode));
  const [roomCodeInput, setRoomCodeInput] = useState<string>(initialRoomCode);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCodeInput(initialRoomCode.toUpperCase());
      setShowJoinBox(true);
    }
  }, [initialRoomCode]);

  const validateName = (): boolean => {
    if (!playerName.trim()) {
      setErrorMsg('Please enter your name first!');
      return false;
    }
    return true;
  };

  const handleCreateClick = async () => {
    playClick();
    setErrorMsg(null);
    if (!validateName()) return;
    setIsSubmitting(true);
    try {
      await onCreateRoom();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleJoinBox = () => {
    playClick();
    setErrorMsg(null);
    setShowJoinBox((prev) => !prev);
  };

  const handleJoinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    playClick();
    setErrorMsg(null);
    if (!validateName()) return;

    const cleanCode = roomCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMsg('Please enter a 5-character room code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onJoinRoom(cleanCode);
      if (!res.ok && res.error) {
        setErrorMsg(res.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-between min-h-[calc(100dvh-2rem)] py-4 px-4">
      {/* Top & Center Content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {/* Playful B.I.N.G.O! Title */}
        <div className="mb-3 text-center select-none">
          <div className="inline-flex items-baseline justify-center flex-wrap">
            {TITLE_LETTERS.map((item, idx) => (
              <span
                key={idx}
                className={`font-display font-bold inline-block drop-shadow-sm transition-transform hover:scale-110 ${
                  item.isDot
                    ? 'text-3xl sm:text-4xl mx-0.5'
                    : 'text-5xl sm:text-6xl tracking-tight'
                } ${item.color}`}
              >
                {item.char}
              </span>
            ))}
          </div>
          <p className="text-sm sm:text-base font-bold text-slate-500 mt-1">
            Classic 5×5 Number Bingo with Friends
          </p>
        </div>

        {/* Card Container */}
        <div className="w-full bg-white rounded-3xl border-[3px] border-slate-800 p-5 sm:p-6 tactile-card mt-3 space-y-4">
          <div>
            <label
              htmlFor="player-name-input"
              className="block text-xs font-extrabold text-slate-500 mb-1.5 ml-1"
            >
              Your Nickname (max 12 chars)
            </label>
            <div className="relative">
              <input
                id="player-name-input"
                type="text"
                maxLength={12}
                value={playerName}
                onChange={(e) => {
                  onPlayerNameChange(e.target.value.slice(0, 12));
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Enter Your Name Here..."
                className="w-full h-14 px-4 rounded-2xl border-[3px] border-slate-800 bg-amber-50/60 text-slate-900 font-display font-bold text-lg placeholder:text-slate-400 placeholder:font-sans placeholder:font-semibold focus:outline-none focus:bg-white focus:ring-3 focus:ring-amber-300 transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono-code font-bold text-slate-400">
                {playerName.length}/12
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-700 text-sm font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="flex-1">{errorMsg}</span>
            </div>
          )}

          {/* CREATE ROOM Button */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCreateClick}
            className="w-full h-14 rounded-2xl border-[3px] border-slate-800 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-slate-900 font-display font-bold text-xl tracking-wide flex items-center justify-center gap-2.5 tactile-btn cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
            <span>CREATE ROOM</span>
          </button>

          {/* JOIN ROOM Button directly BELOW Create Room */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleToggleJoinBox}
            className={`w-full h-14 rounded-2xl border-[3px] border-slate-800 font-display font-bold text-xl tracking-wide flex items-center justify-center gap-2.5 tactile-btn cursor-pointer transition-colors whitespace-nowrap ${
              showJoinBox
                ? 'bg-amber-300 text-slate-900'
                : 'bg-sky-400 hover:bg-sky-300 text-slate-900'
            }`}
          >
            <LogIn className="w-6 h-6 stroke-[2.75]" />
            <span>JOIN ROOM</span>
          </button>

          {/* Inline Join Code Box */}
          {showJoinBox && (
            <form onSubmit={handleJoinSubmit} className="pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-50 border-2 border-slate-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-600">
                    Enter 5-Character Room Code
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowJoinBox(false)}
                    className="text-slate-400 hover:text-slate-700 p-1"
                    aria-label="Close join box"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={5}
                    value={roomCodeInput}
                    onChange={(e) => {
                      const cleaned = e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .slice(0, 5);
                      setRoomCodeInput(cleaned);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="XF3A7"
                    className="flex-1 h-12 px-3.5 rounded-xl border-[2.5px] border-slate-800 bg-white text-center font-mono-code font-bold text-xl tracking-[0.2em] uppercase text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-12 px-5 rounded-xl border-[2.5px] border-slate-800 bg-violet-500 hover:bg-violet-400 text-white font-display font-bold text-base flex items-center gap-1.5 tactile-btn cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.75]" />
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 3 Round Icon Buttons at bottom */}
      <div className="pt-6 pb-2 flex items-center justify-center gap-7 sm:gap-10">
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              playClick();
              onOpenSettings();
            }}
            aria-label="Settings"
            className="w-14 h-14 rounded-full border-[3px] border-slate-800 bg-white hover:bg-amber-100 text-slate-800 flex items-center justify-center tactile-btn cursor-pointer"
          >
            <Settings className="w-6 h-6 stroke-[2.5]" />
          </button>
          <span className="text-xs font-extrabold text-slate-600">Settings</span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onToggleSound();
            }}
            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
            className={`w-14 h-14 rounded-full border-[3px] border-slate-800 flex items-center justify-center tactile-btn cursor-pointer transition-colors ${
              soundEnabled
                ? 'bg-amber-300 hover:bg-amber-200 text-slate-900'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-500'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-6 h-6 stroke-[2.5]" />
            ) : (
              <VolumeX className="w-6 h-6 stroke-[2.5]" />
            )}
          </button>
          <span className="text-xs font-extrabold text-slate-600">
            {soundEnabled ? 'Sound On' : 'Muted'}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              playClick();
              onOpenHelp();
            }}
            aria-label="How to Play?"
            className="w-14 h-14 rounded-full border-[3px] border-slate-800 bg-white hover:bg-sky-100 text-slate-800 flex items-center justify-center tactile-btn cursor-pointer"
          >
            <HelpCircle className="w-6 h-6 stroke-[2.5]" />
          </button>
          <span className="text-xs font-extrabold text-slate-600">How to Play?</span>
        </div>
      </div>
    </div>
  );
};
