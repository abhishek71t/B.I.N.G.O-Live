import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Check, Eye, LogOut, Sparkles, Trophy } from 'lucide-react';
import { Player, RoomState } from '../types/game';
import { evaluateGridLines, generateRandomGrid } from '../utils/bingoLogic';
import { Timer } from './Timer';
import { BingoLetters } from './BingoLetters';

interface GameBoardProps {
  room: RoomState;
  uid: string;
  myGrid: (number | null)[];
  setMyGrid: React.Dispatch<React.SetStateAction<(number | null)[]>>;
  onCallNumber: (num: number) => void;
  onLeaveRoom: () => void;
  getServerNow: () => number;
  playMark: () => void;
  playTurnChange: () => void;
  playTick: (urgent?: boolean) => void;
  playLineComplete: (count?: number) => void;
  playClick: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  room,
  uid,
  myGrid,
  setMyGrid,
  onCallNumber,
  onLeaveRoom,
  getServerNow,
  playMark,
  playTurnChange,
  playTick,
  playLineComplete,
  playClick,
}) => {
  // Ensure grid is filled
  useEffect(() => {
    if (myGrid.some((c) => c === null)) {
      setMyGrid(generateRandomGrid());
    }
  }, [myGrid, setMyGrid]);

  const calledNumbers = room.calledNumbers || [];
  const calledSet = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  const lastCalledNumber =
    calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null;

  const { completedCellIndices, linesCount } = useMemo(
    () => evaluateGridLines(myGrid, calledNumbers),
    [myGrid, calledNumbers]
  );

  const isMyTurn = room.currentTurnPlayerId === uid;
  const currentTurnPlayer: Player | undefined = room.currentTurnPlayerId
    ? room.players[room.currentTurnPlayerId]
    : undefined;

  const myPlayer = room.players[uid];
  const amIFinished = Boolean(myPlayer && (myPlayer.linesCompleted >= 5 || myPlayer.finishedRank));

  // Local strict lock: prevents double taps or calling another number on same turn
  const [hasTappedInTurn, setHasTappedInTurn] = useState<boolean>(false);

  useEffect(() => {
    // When turn changes, reset the tap lock
    setHasTappedInTurn(false);
  }, [room.currentTurnPlayerId]);

  // Audio triggers
  const prevCalledCountRef = useRef<number>(calledNumbers.length);
  const prevLinesCountRef = useRef<number>(linesCount);
  const prevTurnPlayerRef = useRef<string | null>(room.currentTurnPlayerId);

  useEffect(() => {
    if (calledNumbers.length > prevCalledCountRef.current) {
      playMark();
    }
    prevCalledCountRef.current = calledNumbers.length;
  }, [calledNumbers.length, playMark]);

  useEffect(() => {
    if (linesCount > prevLinesCountRef.current) {
      const delta = linesCount - prevLinesCountRef.current;
      playLineComplete(delta);
    }
    prevLinesCountRef.current = linesCount;
  }, [linesCount, playLineComplete]);

  useEffect(() => {
    if (
      room.currentTurnPlayerId &&
      room.currentTurnPlayerId !== prevTurnPlayerRef.current &&
      room.currentTurnPlayerId === uid
    ) {
      playTurnChange();
    }
    prevTurnPlayerRef.current = room.currentTurnPlayerId;
  }, [room.currentTurnPlayerId, uid, playTurnChange]);

  const otherPlayers = useMemo(
    () =>
      Object.values(room.players)
        .filter((p) => p.id !== uid)
        .sort((a, b) => a.joinedAt - b.joinedAt),
    [room.players, uid]
  );

  const handleCellClick = (num: number | null) => {
    if (num === null) return;
    if (!isMyTurn || amIFinished || hasTappedInTurn) return;
    if (calledSet.has(num)) return;

    // Strict turn lock
    setHasTappedInTurn(true);
    onCallNumber(num);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-between min-h-[calc(100dvh-1rem)] py-2 px-3 sm:px-4">
      {/* Top HUD: Left Timer Box | Center Turn Banner | Right Calm Profile (NO Blinking) */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          {/* Top-Left: Rounded 15s Timer Box */}
          <div className="flex items-center gap-2">
            <Timer
              deadline={room.turnDeadline}
              getServerNow={getServerNow}
              maxSeconds={15}
              variant="game"
              onUrgentTick={(sec) => playTick(sec <= 3)}
            />
          </div>

          {/* Center Banner */}
          <div className="flex-1 flex flex-col items-center justify-center pt-2.5 px-1">
            {amIFinished ? (
              <div className="px-3 py-1.5 rounded-2xl bg-amber-300 border-2 border-slate-800 text-slate-900 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs whitespace-nowrap">
                <Trophy className="w-4 h-4 text-amber-800 shrink-0" />
                <span>BINGO! Finished #{myPlayer?.finishedRank || 1}</span>
                <Eye className="w-3.5 h-3.5 opacity-75 ml-0.5" />
              </div>
            ) : isMyTurn ? (
              <div className="px-3.5 py-1.5 rounded-2xl bg-emerald-400 border-2 border-slate-800 text-slate-900 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 tactile-cell whitespace-nowrap">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{hasTappedInTurn ? 'Calling number...' : 'Your turn! Tap a number'}</span>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-2xl bg-white border-2 border-slate-300 text-slate-600 font-display font-bold text-xs sm:text-sm truncate max-w-[160px]">
                {currentTurnPlayer ? `${currentTurnPlayer.name}'s turn` : 'Waiting...'}
              </div>
            )}

            {/* Last called number */}
            {lastCalledNumber !== null && (
              <div className="mt-1 text-[11px] font-extrabold text-slate-600 flex items-center gap-1">
                <span>Last Called:</span>
                <span className="font-mono-code font-bold text-slate-900 bg-amber-200 px-1.5 py-0.5 rounded border border-slate-700">
                  {lastCalledNumber}
                </span>
              </div>
            )}
          </div>

          {/* Top-Right: Simple Calm Profile (No Annoying Blinking, Clear Name & Avatar) */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px] font-bold text-slate-500 tracking-wide">
                Current Turn
              </span>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  onLeaveRoom();
                }}
                title="Leave Game"
                aria-label="Leave Game"
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {currentTurnPlayer && (
              <div className="flex flex-col items-center">
                {/* Clean, calm profile logo with solid border (no blinking rings) */}
                <div
                  className="w-12 h-12 rounded-2xl border-[3px] border-slate-800 flex items-center justify-center text-white font-display font-bold text-xl shadow-xs"
                  style={{ backgroundColor: currentTurnPlayer.avatarColor }}
                >
                  {currentTurnPlayer.avatarIcon || currentTurnPlayer.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-display font-bold text-xs text-slate-800 mt-1 max-w-[76px] truncate text-center">
                  {currentTurnPlayer.id === uid ? 'You' : currentTurnPlayer.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 5x5 Main Grid */}
        <div
          className={`bg-white rounded-3xl border-[3px] p-2.5 sm:p-3.5 tactile-card transition-colors ${
            isMyTurn && !amIFinished && !hasTappedInTurn
              ? 'border-emerald-600 ring-4 ring-emerald-300/50'
              : 'border-slate-800'
          }`}
        >
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 aspect-square w-full">
            {myGrid.map((num, idx) => {
              const isMarked = num !== null && calledSet.has(num);
              const isInCompletedLine = completedCellIndices.has(idx);
              const isLastCalled = num !== null && num === lastCalledNumber;
              const canTap = isMyTurn && !amIFinished && !isMarked && !hasTappedInTurn;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canTap}
                  onClick={() => handleCellClick(num)}
                  className={`relative w-full h-full rounded-xl sm:rounded-2xl border-[2.5px] font-display font-bold text-xl sm:text-2xl flex items-center justify-center select-none transition-all duration-75 ${
                    isMarked
                      ? isInCompletedLine
                        ? 'bg-emerald-500 border-slate-900 text-white shadow-inner scale-102'
                        : 'bg-sky-500 border-slate-900 text-white'
                      : canTap
                      ? 'bg-amber-50 hover:bg-emerald-50 active:scale-95 border-slate-800 text-slate-900 tactile-cell cursor-pointer'
                      : 'bg-slate-50 border-slate-300 text-slate-700 cursor-default'
                  } ${
                    isLastCalled
                      ? 'ring-[3.5px] ring-amber-400 ring-offset-1 z-10'
                      : ''
                  }`}
                >
                  <span className="relative z-10">{num}</span>

                  {isMarked && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/25 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />
                    </span>
                  )}

                  {isLastCalled && (
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 bg-amber-400 border border-slate-900 rounded text-[9px] font-extrabold text-slate-900 leading-tight uppercase tracking-wider z-20">
                      LAST
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* B I N G O Letters */}
        <div className="mt-2.5">
          <BingoLetters linesCompleted={linesCount} />
        </div>
      </div>

      {/* Bottom Zone: Other Players (Grids HIDDEN for anti-cheating, showing only line progress) */}
      <div className="space-y-2 pt-1">
        {otherPlayers.length > 0 && (
          <div className="bg-white/95 rounded-2xl border-2 border-slate-800 p-2.5 shadow-xs">
            <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
              {otherPlayers.map((opponent) => {
                const isTheirTurn = room.currentTurnPlayerId === opponent.id;
                return (
                  <div
                    key={opponent.id}
                    className={`flex-1 min-w-[130px] flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border transition-colors ${
                      isTheirTurn
                        ? 'bg-amber-100/90 border-amber-500'
                        : !opponent.connected
                        ? 'bg-slate-100 border-slate-200 opacity-60'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Simple calm profile avatar */}
                      <div
                        className="w-7 h-7 rounded-full border border-slate-800 flex items-center justify-center text-white font-display font-bold text-xs shrink-0"
                        style={{ backgroundColor: opponent.avatarColor }}
                      >
                        {opponent.avatarIcon || opponent.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="block font-display font-bold text-xs text-slate-800 truncate">
                          {opponent.name}
                        </span>
                        <span className="block text-[10px] font-extrabold text-slate-500">
                          {!opponent.connected
                            ? 'Offline'
                            : opponent.finishedRank
                            ? `Rank #${opponent.finishedRank} 🏆`
                            : isTheirTurn
                            ? 'Their turn...'
                            : `${Math.min(5, opponent.linesCompleted)}/5 lines`}
                        </span>
                      </div>
                    </div>

                    {/* Only show letters crossed out count, NEVER their private numbers! */}
                    <BingoLetters linesCompleted={opponent.linesCompleted} compact />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Called Numbers History */}
        <div className="bg-white/90 rounded-2xl border-2 border-slate-800 px-3 py-2 flex items-center gap-2.5 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-600 shrink-0">
            Called ({calledNumbers.length}/25):
          </span>
          {calledNumbers.length === 0 ? (
            <span className="text-xs font-semibold text-slate-400">
              No numbers called yet
            </span>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[...calledNumbers].reverse().map((num, idx) => {
                const isLatest = idx === 0;
                return (
                  <span
                    key={`${num}-${idx}`}
                    className={`w-7 h-7 rounded-lg font-mono-code font-bold text-xs flex items-center justify-center shrink-0 border ${
                      isLatest
                        ? 'bg-amber-400 border-slate-900 text-slate-900 font-extrabold scale-105'
                        : 'bg-slate-100 border-slate-300 text-slate-600'
                    }`}
                  >
                    {num}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
