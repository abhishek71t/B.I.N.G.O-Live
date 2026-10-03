import { useState, useEffect, useCallback } from 'react';
import { useSound } from './hooks/useSound';
import { useRoomSync } from './hooks/useRoomSync';
import { Home } from './components/Home';
import { WaitingRoom } from './components/WaitingRoom';
import { GridSetup } from './components/GridSetup';
import { GameBoard } from './components/GameBoard';
import { ResultScreen } from './components/ResultScreen';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';

const STORAGE_KEY_NAME = 'bingo_player_name';

interface ToastState {
  id: number;
  message: string;
  type: 'info' | 'warning' | 'success';
}

export function App() {
  const [playerName, setPlayerName] = useState<string>(() => {
    return (localStorage.getItem(STORAGE_KEY_NAME) || '').slice(0, 12);
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [urlRoomCode, setUrlRoomCode] = useState<string>('');

  const sound = useSound();

  const showToast = useCallback(
    (message: string, type: 'info' | 'warning' | 'success' = 'info') => {
      setToast({ id: Date.now(), message, type });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3400);
    return () => clearTimeout(timer);
  }, [toast]);

  const handlePlayerNameChange = useCallback((newName: string) => {
    const cleaned = newName.slice(0, 12);
    setPlayerName(cleaned);
    localStorage.setItem(STORAGE_KEY_NAME, cleaned);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('room');
    if (codeParam) {
      setUrlRoomCode(codeParam.trim().toUpperCase().slice(0, 5));
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

  const {
    uid,
    room,
    myGrid,
    setMyGrid,
    getServerNow,
    createRoom,
    joinRoom,
    leaveRoom,
    setMaxPlayers,
    toggleWaitingReady,
    addBotPlayer,
    removeBotPlayer,
    startGridSetup,
    confirmGridReady,
    callNumber,
    requestPlayAgain,
    updateMyNameInRoom,
  } = useRoomSync(showToast, sound.playPlayerJoined);

  const handleCreateRoom = useCallback(async () => {
    await createRoom(playerName);
  }, [createRoom, playerName]);

  const handleJoinRoom = useCallback(
    async (code: string) => {
      return await joinRoom(playerName, code);
    },
    [joinRoom, playerName]
  );

  const handleSaveNameFromSettings = useCallback(
    (newName: string) => {
      handlePlayerNameChange(newName);
      updateMyNameInRoom(newName);
    },
    [handlePlayerNameChange, updateMyNameInRoom]
  );

  return (
    <div className="min-h-dvh w-full bg-gradient-to-br from-amber-50 via-rose-50/70 to-sky-100 bg-notebook-pattern text-slate-800 relative overflow-x-hidden flex flex-col justify-center">
      {/* Toast Notification */}
      {toast && (
        <div
          key={toast.id}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl border-2 border-slate-800 font-display font-bold text-sm shadow-md max-w-[92vw] text-center whitespace-nowrap truncate animate-fade-in"
          style={{
            backgroundColor:
              toast.type === 'warning'
                ? '#FDE68A'
                : toast.type === 'success'
                ? '#A7F3D0'
                : '#E0F2FE',
            color: '#0F172A',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Main Screen Router */}
      <main className="w-full flex-1 flex flex-col justify-center">
        {!room ? (
          <Home
            key="screen-home"
            playerName={playerName}
            onPlayerNameChange={handlePlayerNameChange}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            soundEnabled={sound.soundEnabled}
            onToggleSound={() => {
              sound.toggleSound();
              sound.playClick();
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenHelp={() => setIsHelpOpen(true)}
            playClick={sound.playClick}
            initialRoomCode={urlRoomCode}
          />
        ) : room.roomStatus === 'waiting' ? (
          <WaitingRoom
            key="screen-waiting"
            room={room}
            uid={uid}
            onLeaveRoom={leaveRoom}
            onSetMaxPlayers={setMaxPlayers}
            onToggleReady={toggleWaitingReady}
            onAddBot={addBotPlayer}
            onRemoveBot={removeBotPlayer}
            onStartGame={startGridSetup}
            playClick={sound.playClick}
            onToast={showToast}
          />
        ) : room.roomStatus === 'setup' ? (
          <GridSetup
            key="screen-setup"
            room={room}
            uid={uid}
            myGrid={myGrid}
            setMyGrid={setMyGrid}
            onConfirmGrid={confirmGridReady}
            getServerNow={getServerNow}
            playClick={sound.playClick}
            playMark={sound.playMark}
            playTick={sound.playTick}
          />
        ) : room.roomStatus === 'playing' ? (
          <GameBoard
            key="screen-playing"
            room={room}
            uid={uid}
            myGrid={myGrid}
            setMyGrid={setMyGrid}
            onCallNumber={(num) => callNumber(num, false)}
            onLeaveRoom={leaveRoom}
            getServerNow={getServerNow}
            playMark={sound.playMark}
            playTurnChange={sound.playTurnChange}
            playTick={sound.playTick}
            playLineComplete={sound.playLineComplete}
            playClick={sound.playClick}
          />
        ) : (
          <ResultScreen
            key="screen-results"
            room={room}
            uid={uid}
            onPlayAgain={requestPlayAgain}
            onLeaveRoom={leaveRoom}
            playWin={sound.playWin}
            playLose={sound.playLose}
            playClick={sound.playClick}
          />
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        playerName={playerName}
        onSaveName={handleSaveNameFromSettings}
        soundEnabled={sound.soundEnabled}
        onToggleSound={sound.toggleSound}
        volume={sound.volume}
        onChangeVolume={sound.setVolume}
        vibrationEnabled={sound.vibrationEnabled}
        onToggleVibration={sound.toggleVibration}
        playClick={sound.playClick}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        playClick={sound.playClick}
      />
    </div>
  );
}

export default App;
