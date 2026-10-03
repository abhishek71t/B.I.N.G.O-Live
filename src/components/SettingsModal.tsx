import React, { useState, useEffect } from 'react';
import { X, Volume2, VolumeX, Smartphone, User, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  onSaveName: (newName: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  volume: number;
  onChangeVolume: (vol: number) => void;
  vibrationEnabled: boolean;
  onToggleVibration: () => void;
  playClick: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  playerName,
  onSaveName,
  soundEnabled,
  onToggleSound,
  volume,
  onChangeVolume,
  vibrationEnabled,
  onToggleVibration,
  playClick,
}) => {
  const [draftName, setDraftName] = useState(playerName);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setDraftName(playerName);
  }, [playerName, isOpen]);

  if (!isOpen) return null;

  const handleApplyName = (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    const cleaned = draftName.trim().slice(0, 12);
    if (cleaned) {
      onSaveName(cleaned);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 1800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl border-[3px] border-slate-800 p-5 sm:p-6 tactile-card">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-slate-100">
          <h3 className="font-display font-bold text-2xl text-slate-900">
            Settings
          </h3>
          <button
            type="button"
            onClick={() => {
              playClick();
              onClose();
            }}
            aria-label="Close settings"
            className="w-10 h-10 rounded-xl border-2 border-slate-800 bg-slate-100 hover:bg-rose-100 text-slate-800 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        <div className="space-y-4 py-4">
          {/* 1. Name */}
          <form onSubmit={handleApplyName} className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500">
              <User className="w-3.5 h-3.5" />
              <span>Player Name (max 12 chars)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={12}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value.slice(0, 12))}
                placeholder="Your Name"
                className="flex-1 h-12 px-3.5 rounded-xl border-2 border-slate-800 bg-amber-50/50 font-display font-bold text-base text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-300"
              />
              <button
                type="submit"
                className="h-12 px-4 rounded-xl border-2 border-slate-800 bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-display font-bold text-sm flex items-center gap-1.5 tactile-btn cursor-pointer whitespace-nowrap"
              >
                {savedToast ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </div>
          </form>

          {/* 2. Sound Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl border-2 border-slate-800 bg-amber-300 flex items-center justify-center text-slate-900">
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="block font-display font-bold text-base text-slate-900">
                  Sound Effects
                </span>
                <span className="block text-xs font-semibold text-slate-500">
                  {soundEnabled ? 'Enabled' : 'Muted'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onToggleSound();
              }}
              className={`w-14 h-8 rounded-full border-2 border-slate-800 p-0.5 transition-colors cursor-pointer flex items-center ${
                soundEnabled ? 'bg-emerald-400 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-white border border-slate-800 shadow-xs" />
            </button>
          </div>

          {/* 3. Volume Slider */}
          <div className="p-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-sm text-slate-800">
                Sound Volume
              </span>
              <span className="font-mono-code font-bold text-xs text-slate-600">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              disabled={!soundEnabled}
              value={volume}
              onChange={(e) => {
                onChangeVolume(parseFloat(e.target.value));
              }}
              onMouseUp={playClick}
              onTouchEnd={playClick}
              className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600 disabled:opacity-40"
            />
          </div>

          {/* 4. Vibration Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl border-2 border-slate-800 bg-sky-300 flex items-center justify-center text-slate-900">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <span className="block font-display font-bold text-base text-slate-900">
                  Haptic Vibration
                </span>
                <span className="block text-xs font-semibold text-slate-500">
                  {vibrationEnabled ? 'Vibrate on mobile taps' : 'Off'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onToggleVibration();
                playClick();
              }}
              className={`w-14 h-8 rounded-full border-2 border-slate-800 p-0.5 transition-colors cursor-pointer flex items-center ${
                vibrationEnabled ? 'bg-emerald-400 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-white border border-slate-800 shadow-xs" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playClick();
            if (draftName.trim()) {
              onSaveName(draftName.trim().slice(0, 12));
            }
            onClose();
          }}
          className="w-full h-12 rounded-2xl border-[2.5px] border-slate-800 bg-violet-500 hover:bg-violet-400 text-white font-display font-bold text-base tactile-btn cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};
