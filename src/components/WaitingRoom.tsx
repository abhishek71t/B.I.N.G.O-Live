import React, { useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Share2,
  Crown,
  UserCheck,
  Clock,
  Play,
  Bot,
  Trash2,
  Users,
} from 'lucide-react';
import { Player, RoomState } from '../types/game';

interface WaitingRoomProps {
  room: RoomState;
  uid: string;
  onLeaveRoom: () => void;
  onSetMaxPlayers: (count: 2 | 3 | 4) => void;
  onToggleReady: () => void;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => void;
  onStartGame: () => void;
  playClick: () => void;
  onToast: (msg: string, type?: 'info' | 'warning' | 'success') => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  room,
  uid,
  onLeaveRoom,
  onSetMaxPlayers,
  onToggleReady,
  onAddBot,
  onRemoveBot,
  onStartGame,
  playClick,
  onToast,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const isHost = room.hostId === uid;
  const playersList: Player[] = Object.values(room.players).sort(
    (a, b) => a.joinedAt - b.joinedAt
  );
  const myPlayer = room.players[uid];

  const emptySlotsCount = Math.max(0, room.maxPlayers - playersList.length);
  const isRoomFull = playersList.length === room.maxPlayers;
  const areAllReady = playersList.every((p) => p.ready);
  const canStart = isHost && isRoomFull && areAllReady;

  let startHint = '';
  if (!isRoomFull) {
    const missing = room.maxPlayers - playersList.length;
    startHint = `Waiting for ${missing} more player${missing > 1 ? 's' : ''}`;
  } else if (!areAllReady) {
    const unreadyCount = playersList.filter((p) => !p.ready).length;
    startHint = `Waiting for ${unreadyCount} player${unreadyCount > 1 ? 's' : ''} to tap Ready`;
  }

  const handleCopyCode = async () => {
    playClick();
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      onToast(`Room code ${room.code} copied!`, 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      onToast(`Room code: ${room.code}`, 'info');
    }
  };

  const handleShareCode = async () => {
    playClick();
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    const shareText = `Join my B.I.N.G.O! game! Room Code: ${room.code}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'B.I.N.G.O! Live',
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText} — ${shareUrl}`);
      setCopiedCode(true);
      onToast('Invite link & room code copied!', 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      handleCopyCode();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-between min-h-[calc(100dvh-2rem)] py-3 px-4">
      {/* Top Bar with Back Arrow matching Sketch 2 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => {
              playClick();
              onLeaveRoom();
            }}
            aria-label="Leave room"
            className="w-12 h-12 rounded-2xl border-[3px] border-slate-800 bg-white hover:bg-rose-50 text-slate-800 flex items-center justify-center tactile-btn cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.75]" />
          </button>

          <h2 className="font-display font-bold text-2xl text-slate-800">
            Waiting Room
          </h2>

          <div className="w-12 h-12 flex items-center justify-center text-xs font-mono-code font-bold text-slate-500">
            {playersList.length}/{room.maxPlayers}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl border-[3px] border-slate-800 p-5 tactile-card space-y-4">
          {/* Number of Players Selector: 2, 3, 4 matching Sketch 2 */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span className="font-display font-bold text-sm text-slate-700">
                Number of Players
              </span>
            </div>

            <div className="flex items-center justify-center gap-4">
              {([2, 3, 4] as const).map((num) => {
                const isSelected = room.maxPlayers === num;
                const isDisabled = !isHost || num < playersList.length;

                return (
                  <button
                    key={num}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      playClick();
                      onSetMaxPlayers(num);
                    }}
                    className={`w-16 h-16 rounded-2xl border-[3px] border-slate-800 font-display font-bold text-2xl flex items-center justify-center tactile-btn transition-all ${
                      isSelected
                        ? 'bg-amber-400 text-slate-900 ring-4 ring-amber-200 scale-105'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                    } ${
                      !isHost
                        ? 'cursor-default'
                        : isDisabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'cursor-pointer'
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
            {!isHost && (
              <span className="block text-[11px] font-semibold text-slate-400 mt-1">
                (Host selects player capacity)
              </span>
            )}
          </div>

          {/* Room Code Box with Copy & Share matching Sketch 2 */}
          <div className="bg-amber-50/80 rounded-2xl border-[3px] border-slate-800 p-4 text-center">
            <span className="block text-xs font-extrabold text-slate-500 mb-1">
              Room Code — Share with Friends
            </span>
            <div className="font-mono-code font-bold text-3xl sm:text-4xl tracking-[0.22em] text-slate-900 my-1 select-all">
              {room.code}
            </div>

            <div className="flex items-center justify-center gap-2.5 mt-3">
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex-1 h-11 px-3 rounded-xl border-2 border-slate-800 bg-white hover:bg-amber-100 text-slate-800 font-display font-bold text-sm flex items-center justify-center gap-1.5 tactile-btn cursor-pointer whitespace-nowrap"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShareCode}
                className="flex-1 h-11 px-3 rounded-xl border-2 border-slate-800 bg-sky-400 hover:bg-sky-300 text-slate-900 font-display font-bold text-sm flex items-center justify-center gap-1.5 tactile-btn cursor-pointer whitespace-nowrap"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Invite</span>
              </button>
            </div>
          </div>

          {/* Live Player List matching Sketch 2 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-slate-500">
                Players in Room ({playersList.length}/{room.maxPlayers})
              </span>
              {isHost && emptySlotsCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    onAddBot();
                  }}
                  className="px-2.5 py-1 rounded-lg border-2 border-violet-500 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>+ Add Test Bot</span>
                </button>
              )}
            </div>

            {playersList.map((player) => {
              const isMe = player.id === uid;
              const isPlayerHost = player.id === room.hostId;

              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-2xl border-2 border-slate-800 bg-slate-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Clean, steady avatar with no blinking */}
                    <div
                      className="w-10 h-10 rounded-full border-2 border-slate-800 flex items-center justify-center text-white font-display font-bold text-base shrink-0 shadow-xs"
                      style={{ backgroundColor: player.avatarColor }}
                    >
                      {player.avatarIcon || player.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-bold text-base text-slate-900 truncate">
                          {player.name}
                        </span>
                        {isMe && (
                          <span className="text-xs font-bold text-slate-500">
                            (You)
                          </span>
                        )}
                        {isPlayerHost && (
                          <Crown
                            className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0"
                            aria-label="Host"
                          />
                        )}
                      </div>
                      <span className="block text-xs text-slate-500 font-semibold">
                        {isPlayerHost
                          ? 'Room Host'
                          : player.isBot
                          ? 'AI Friend'
                          : 'Friend'}
                      </span>
                    </div>
                  </div>

                  {/* Ready / Waiting Badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    {player.ready ? (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Waiting...</span>
                      </span>
                    )}

                    {isHost && player.isBot && (
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          onRemoveBot(player.id);
                        }}
                        aria-label={`Remove ${player.name}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty Player Slots */}
            {Array.from({ length: emptySlotsCount }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="flex items-center justify-between p-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 text-slate-400"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                    <Users className="w-4 h-4 text-slate-300" />
                  </div>
                  <span className="font-display font-semibold text-sm text-slate-400">
                    Waiting for player...
                  </span>
                </div>

                {isHost && (
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      onAddBot();
                    }}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-violet-50 text-slate-600 hover:text-violet-700 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    + Add Bot
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar: START (Host) or READY (Joiner) */}
      <div className="pt-4 pb-2">
        {isHost ? (
          <div className="space-y-2 text-center">
            {!canStart && startHint && (
              <p className="text-xs font-extrabold text-slate-500">
                {startHint}
              </p>
            )}
            <button
              type="button"
              disabled={!canStart}
              onClick={() => {
                playClick();
                onStartGame();
              }}
              className={`w-full h-14 rounded-2xl border-[3px] border-slate-800 font-display font-bold text-xl tracking-wide flex items-center justify-center gap-2 tactile-btn transition-all whitespace-nowrap ${
                canStart
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-900 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 border-slate-400 cursor-not-allowed opacity-80'
              }`}
            >
              <Play className="w-6 h-6 fill-current" />
              <span>START GAME</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2 text-center">
            <p className="text-xs font-extrabold text-slate-500">
              {myPlayer?.ready
                ? 'You are ready! Waiting for host to start...'
                : 'Tap Ready when you are set to play!'}
            </p>
            <button
              type="button"
              onClick={() => {
                playClick();
                onToggleReady();
              }}
              className={`w-full h-14 rounded-2xl border-[3px] border-slate-800 font-display font-bold text-xl tracking-wide flex items-center justify-center gap-2 tactile-btn cursor-pointer transition-colors whitespace-nowrap ${
                myPlayer?.ready
                  ? 'bg-amber-300 hover:bg-amber-200 text-slate-900'
                  : 'bg-emerald-400 hover:bg-emerald-300 text-slate-900'
              }`}
            >
              <UserCheck className="w-6 h-6 stroke-[2.75]" />
              <span>{myPlayer?.ready ? 'READY! (TAP TO CANCEL)' : "I'M READY!"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
