import React, { useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, LogOut, CheckCircle2, Medal, Award, AlertTriangle } from 'lucide-react';
import { Player, RoomState } from '../types/game';
import { BingoLetters } from './BingoLetters';

interface ResultScreenProps {
  room: RoomState;
  uid: string;
  onPlayAgain: () => void;
  onLeaveRoom: () => void;
  playWin: () => void;
  playLose: () => void;
  playClick: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  room,
  uid,
  onPlayAgain,
  onLeaveRoom,
  playWin,
  playLose,
  playClick,
}) => {
  const playersList: Player[] = useMemo(() => {
    const all = Object.values(room.players);
    return all.sort((a, b) => {
      const rankA = a.finishedRank ?? (a.connected ? 99 : 100);
      const rankB = b.finishedRank ?? (b.connected ? 99 : 100);
      if (rankA !== rankB) return rankA - rankB;
      return b.linesCompleted - a.linesCompleted;
    });
  }, [room.players]);

  const myPlayer = room.players[uid];
  const myRank = myPlayer?.finishedRank ?? 1;

  const rankCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    playersList.forEach((p) => {
      const r = p.finishedRank ?? 99;
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [playersList]);

  const maxAssignedRank = useMemo(() => {
    const ranks = playersList
      .filter((p) => p.connected)
      .map((p) => p.finishedRank ?? 1);
    return ranks.length > 0 ? Math.max(...ranks) : 1;
  }, [playersList]);

  const isWinner = myRank === 1 || room.winReason === 'opponent_left';
  const isLastPlace =
    room.winReason !== 'opponent_left' &&
    myRank === maxAssignedRank &&
    maxAssignedRank > 1;

  useEffect(() => {
    if (isWinner) {
      playWin();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.55 },
        });
      } catch {
        // Ignore
      }
    } else if (isLastPlace) {
      playLose();
    } else {
      playWin();
    }
  }, [isWinner, isLastPlace, playWin, playLose]);

  const connectedPlayers = playersList.filter((p) => p.connected);
  const readyForRematchCount = connectedPlayers.filter((p) => p.playAgainReady).length;
  const amIReadyForRematch = Boolean(myPlayer?.playAgainReady);

  const getRankLabel = (player: Player) => {
    if (!player.connected) return 'Disconnected';
    const r = player.finishedRank ?? maxAssignedRank;
    const isTie = (rankCounts[r] || 0) > 1;
    const tieSuffix = isTie ? ' (Tie!)' : '';

    if (r === 1) return `1st Place 🏆${tieSuffix}`;
    if (r === maxAssignedRank && connectedPlayers.length >= 2 && !isTie) {
      return connectedPlayers.length >= 3 ? `Last Place (Loser)` : `2nd Place`;
    }
    if (r === 2) return `2nd Place 🥈${tieSuffix}`;
    if (r === 3) return `3rd Place 🥉${tieSuffix}`;
    return `${r}th Place${tieSuffix}`;
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-between min-h-[calc(100dvh-2rem)] py-3 px-4">
      <div>
        {/* Header */}
        <div className="text-center mb-4">
          <div
            className={`w-20 h-20 mx-auto rounded-3xl border-[3px] border-slate-800 flex items-center justify-center tactile-card mb-3 ${
              isWinner
                ? 'bg-amber-300 text-slate-900'
                : isLastPlace
                ? 'bg-rose-200 text-rose-800'
                : 'bg-sky-300 text-slate-900'
            }`}
          >
            {isWinner ? (
              <Trophy className="w-10 h-10 text-amber-700 fill-amber-400" />
            ) : isLastPlace ? (
              <Award className="w-10 h-10 text-rose-700" />
            ) : (
              <Medal className="w-10 h-10 text-sky-800" />
            )}
          </div>

          <h2 className="font-display font-bold text-3xl sm:text-4xl text-slate-900">
            {room.winReason === 'opponent_left'
              ? 'You Win!'
              : isWinner
              ? (rankCounts[1] || 0) > 1
                ? "It's a Tie for 1st!"
                : 'B.I.N.G.O! You Won!'
              : isLastPlace
              ? 'Better Luck Next Time!'
              : `You Finished #${myRank}!`}
          </h2>

          {room.winReason === 'opponent_left' ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 mt-1">
              <AlertTriangle className="w-4 h-4" />
              <span>Opponent left the game</span>
            </p>
          ) : (
            <p className="text-sm font-bold text-slate-500 mt-1">
              {room.calledNumbers.length} numbers called in this match
            </p>
          )}
        </div>

        {/* Final Standings */}
        <div className="bg-white rounded-3xl border-[3px] border-slate-800 p-4 sm:p-5 tactile-card space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-extrabold text-slate-500">
              Final Standings
            </span>
            <span className="text-xs font-bold text-slate-400">
              Lines · BINGO
            </span>
          </div>

          <div className="space-y-2.5">
            {playersList.map((player) => {
              const rank = player.finishedRank ?? maxAssignedRank;
              const isMe = player.id === uid;
              const isFirst = rank === 1 && player.connected;

              return (
                <div
                  key={player.id}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-between gap-2 ${
                    isFirst
                      ? 'bg-amber-50 border-slate-900'
                      : isMe
                      ? 'bg-sky-50/70 border-slate-800'
                      : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl border-2 border-slate-800 font-display font-bold text-base flex items-center justify-center shrink-0 ${
                        isFirst
                          ? 'bg-amber-400 text-slate-900'
                          : rank === 2
                          ? 'bg-slate-200 text-slate-800'
                          : rank === 3
                          ? 'bg-orange-200 text-slate-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      #{rank}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-slate-800 shrink-0"
                          style={{ backgroundColor: player.avatarColor }}
                        />
                        <span className="font-display font-bold text-base text-slate-900 truncate">
                          {player.name}
                        </span>
                        {isMe && (
                          <span className="text-xs font-bold text-slate-500">
                            (You)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-xs font-extrabold ${
                            isFirst
                              ? 'text-amber-700'
                              : !player.connected
                              ? 'text-slate-400'
                              : rank === maxAssignedRank && maxAssignedRank > 1
                              ? 'text-rose-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {getRankLabel(player)}
                        </span>

                        {player.playAgainReady && player.connected && (
                          <span className="text-[11px] font-bold text-emerald-600">
                            · Rematch Ready
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <BingoLetters linesCompleted={player.linesCompleted} compact />
                    <span className="text-[11px] font-mono-code font-bold text-slate-500">
                      {player.linesCompleted} line{player.linesCompleted === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="pt-4 pb-2 space-y-2.5">
        <button
          type="button"
          disabled={amIReadyForRematch && connectedPlayers.length > 1}
          onClick={() => {
            playClick();
            onPlayAgain();
          }}
          className={`w-full h-14 rounded-2xl border-[3px] border-slate-800 font-display font-bold text-xl flex items-center justify-center gap-2.5 tactile-btn transition-colors whitespace-nowrap ${
            amIReadyForRematch
              ? 'bg-emerald-100 text-emerald-900 border-emerald-700 cursor-default'
              : 'bg-emerald-400 hover:bg-emerald-300 text-slate-900 cursor-pointer'
          }`}
        >
          {amIReadyForRematch ? (
            <>
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
              <span>
                Waiting for Friends ({readyForRematchCount}/{connectedPlayers.length})...
              </span>
            </>
          ) : (
            <>
              <RotateCcw className="w-6 h-6 stroke-[2.75]" />
              <span>
                PLAY AGAIN{' '}
                {readyForRematchCount > 0
                  ? `(${readyForRematchCount}/${connectedPlayers.length} Ready)`
                  : ''}
              </span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            playClick();
            onLeaveRoom();
          }}
          className="w-full h-12 rounded-2xl border-[2.5px] border-slate-800 bg-white hover:bg-rose-50 text-slate-700 font-display font-bold text-base flex items-center justify-center gap-2 tactile-btn cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-5 h-5" />
          <span>LEAVE ROOM</span>
        </button>
      </div>
    </div>
  );
};
