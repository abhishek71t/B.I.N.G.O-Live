import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Shuffle, RotateCcw, CheckCircle2, Sparkles } from 'lucide-react';
import { RoomState } from '../types/game';
import { generateRandomGrid, autoFillPartialGrid } from '../utils/bingoLogic';
import { Timer } from './Timer';

interface GridSetupProps {
  room: RoomState;
  uid: string;
  myGrid: (number | null)[];
  setMyGrid: React.Dispatch<React.SetStateAction<(number | null)[]>>;
  onConfirmGrid: (finalGrid: number[]) => void;
  getServerNow: () => number;
  playClick: () => void;
  playMark: () => void;
  playTick: (urgent?: boolean) => void;
}

export const GridSetup: React.FC<GridSetupProps> = ({
  room,
  uid,
  myGrid,
  setMyGrid,
  onConfirmGrid,
  getServerNow,
  playClick,
  playMark,
  playTick,
}) => {
  const myPlayer = room.players[uid];
  const isLocked = Boolean(myPlayer?.gridReady);

  // Set of placed numbers
  const placedNumbersSet = useMemo(() => {
    return new Set(
      myGrid.filter((n): n is number => typeof n === 'number' && n >= 1 && n <= 25)
    );
  }, [myGrid]);

  const placedCount = placedNumbersSet.size;
  const isGridComplete = placedCount === 25;

  // Selected number in number tray
  const [selectedNumber, setSelectedNumber] = useState<number | null>(1);

  // Auto-advance selectedNumber to the next unplaced number
  useEffect(() => {
    if (selectedNumber !== null && placedNumbersSet.has(selectedNumber)) {
      let nextUnused: number | null = null;
      for (let n = 1; n <= 25; n++) {
        if (!placedNumbersSet.has(n)) {
          nextUnused = n;
          break;
        }
      }
      setSelectedNumber(nextUnused);
    } else if (selectedNumber === null && placedCount < 25) {
      for (let n = 1; n <= 25; n++) {
        if (!placedNumbersSet.has(n)) {
          setSelectedNumber(n);
          break;
        }
      }
    }
  }, [placedNumbersSet, selectedNumber, placedCount]);

  const handleShuffle = () => {
    if (isLocked) return;
    playClick();
    const randomGrid = generateRandomGrid();
    setMyGrid(randomGrid);
    setSelectedNumber(null);
  };

  const handleClear = () => {
    if (isLocked) return;
    playClick();
    setMyGrid(Array(25).fill(null));
    setSelectedNumber(1);
  };

  const handleCellClick = (cellIndex: number) => {
    if (isLocked) return;
    const currentVal = myGrid[cellIndex];

    if (currentVal !== null) {
      // Remove existing number
      playClick();
      setMyGrid((prev) => {
        const next = [...prev];
        next[cellIndex] = null;
        return next;
      });
      setSelectedNumber(currentVal);
      return;
    }

    if (selectedNumber !== null && !placedNumbersSet.has(selectedNumber)) {
      playMark();
      setMyGrid((prev) => {
        const next = [...prev];
        next[cellIndex] = selectedNumber;
        return next;
      });
    }
  };

  const handleLockIn = useCallback(() => {
    if (isLocked) return;
    const finalGrid = autoFillPartialGrid(myGrid);
    setMyGrid(finalGrid);
    onConfirmGrid(finalGrid);
  }, [isLocked, myGrid, setMyGrid, onConfirmGrid]);

  const handleTimerExpire = useCallback(() => {
    if (!isLocked) {
      handleLockIn();
    }
  }, [isLocked, handleLockIn]);

  const connectedPlayers = Object.values(room.players).filter((p) => p.connected);
  const readyPlayersCount = connectedPlayers.filter((p) => p.gridReady).length;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-between min-h-[calc(100dvh-1.5rem)] py-2 px-3 sm:px-4">
      {/* Header & 45s Timer */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 leading-tight">
              Build Your 5×5 Grid
            </h2>
            <p className="text-xs font-bold text-slate-500">
              {isLocked
                ? `Grid locked! Waiting for friends (${readyPlayersCount}/${connectedPlayers.length} ready)`
                : `Tap cells or tap Shuffle (${placedCount}/25 placed)`}
            </p>
          </div>

          <Timer
            deadline={room.setupDeadline}
            getServerNow={getServerNow}
            maxSeconds={45}
            variant="setup"
            onUrgentTick={(sec) => playTick(sec <= 3)}
            onExpire={handleTimerExpire}
          />
        </div>

        {/* Toolbar: Shuffle & Clear */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <button
            type="button"
            disabled={isLocked}
            onClick={handleShuffle}
            className="flex-1 h-11 px-3 rounded-2xl border-[2.5px] border-slate-800 bg-violet-500 hover:bg-violet-400 text-white font-display font-bold text-sm flex items-center justify-center gap-2 tactile-btn cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Shuffle className="w-4 h-4 stroke-[2.75]" />
            <span>Shuffle Random</span>
          </button>

          <button
            type="button"
            disabled={isLocked || placedCount === 0}
            onClick={handleClear}
            className="h-11 px-4 rounded-2xl border-[2.5px] border-slate-800 bg-white hover:bg-rose-50 text-slate-700 font-display font-bold text-sm flex items-center justify-center gap-1.5 tactile-btn cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4 stroke-[2.5]" />
            <span>Clear</span>
          </button>
        </div>

        {/* High-Performance 5x5 Grid */}
        <div className="bg-white rounded-3xl border-[3px] border-slate-800 p-2.5 sm:p-3.5 tactile-card">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 aspect-square w-full">
            {myGrid.map((val, idx) => {
              const isFilled = val !== null;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleCellClick(idx)}
                  className={`relative w-full h-full rounded-xl sm:rounded-2xl border-[2.5px] font-display font-bold text-xl sm:text-2xl flex items-center justify-center select-none transition-transform active:scale-95 duration-75 ${
                    isFilled
                      ? isLocked
                        ? 'bg-emerald-50 border-emerald-700 text-emerald-950 cursor-default'
                        : 'bg-amber-200 hover:bg-rose-100 border-slate-800 text-slate-900 tactile-cell cursor-pointer'
                      : 'bg-slate-50 hover:bg-sky-50 border-dashed border-slate-300 text-slate-300 cursor-pointer'
                  }`}
                >
                  {isFilled ? (
                    <span>{val}</span>
                  ) : (
                    <span className="text-xs font-sans font-semibold opacity-40">
                      +
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Responsive Number Tray (1-25) */}
        {!isLocked && (
          <div className="mt-2.5 bg-white/95 rounded-2xl border-2 border-slate-800 p-2.5 shadow-xs">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[11px] font-extrabold text-slate-600">
                Number Tray (Selected: {selectedNumber ?? 'None'})
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Tap cell to place/remove
              </span>
            </div>
            <div className="grid grid-cols-9 sm:grid-cols-9 gap-1">
              {Array.from({ length: 25 }, (_, i) => i + 1).map((num) => {
                const isPlaced = placedNumbersSet.has(num);
                const isSelected = selectedNumber === num && !isPlaced;

                return (
                  <button
                    key={num}
                    type="button"
                    disabled={isPlaced}
                    onClick={() => {
                      playClick();
                      setSelectedNumber(num);
                    }}
                    className={`h-8 rounded-lg font-display font-bold text-xs flex items-center justify-center border transition-all duration-75 ${
                      isPlaced
                        ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed line-through'
                        : isSelected
                        ? 'bg-sky-500 border-slate-900 text-white scale-105 shadow-xs ring-2 ring-sky-300 font-extrabold cursor-pointer'
                        : 'bg-white hover:bg-amber-100 border-slate-300 text-slate-700 cursor-pointer active:scale-95'
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Readiness Indicators & Lock-In Button */}
      <div className="pt-2.5 pb-1 space-y-2">
        <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-600 flex-wrap">
          {connectedPlayers.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block border border-slate-700"
                style={{ backgroundColor: p.avatarColor }}
              />
              <span>{p.name}:</span>
              <span className={p.gridReady ? 'text-emerald-600 font-extrabold' : 'text-amber-600'}>
                {p.gridReady ? 'Ready ✓' : 'Building...'}
              </span>
            </span>
          ))}
        </div>

        <button
          type="button"
          disabled={!isGridComplete || isLocked}
          onClick={() => {
            playClick();
            handleLockIn();
          }}
          className={`w-full h-13 sm:h-14 rounded-2xl border-[3px] border-slate-800 font-display font-bold text-lg sm:text-xl flex items-center justify-center gap-2 tactile-btn transition-all whitespace-nowrap ${
            isLocked
              ? 'bg-emerald-100 text-emerald-800 border-emerald-700 cursor-default'
              : isGridComplete
              ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-900 cursor-pointer'
              : 'bg-slate-200 text-slate-400 border-slate-400 cursor-not-allowed'
          }`}
        >
          {isLocked ? (
            <>
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <span>
                Waiting for others ({readyPlayersCount}/{connectedPlayers.length})...
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-6 h-6 stroke-[2.75]" />
              <span>
                {isGridComplete
                  ? "I'M READY!"
                  : `Place ${25 - placedCount} more number${25 - placedCount === 1 ? '' : 's'}`}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
