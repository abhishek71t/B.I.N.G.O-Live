import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, set, update, get, onValue, onDisconnect } from 'firebase/database';
import { db, isFirebaseConfigured, ensureAnonymousUser } from '../config/firebase';
import { Player, RoomState } from '../types/game';
import {
  generateRoomCodeString,
  isValidRoomCodeFormat,
  pickAvatarColor,
  pickAvatarIcon,
  resolveUniquePlayerName,
  evaluateGridLines,
  pickRandomUncalledNumber,
  computeRankingsAndGameOver,
  generateSeededGrid,
  pickSmartBotNumber,
} from '../utils/bingoLogic';

const ACTIVE_ROOM_KEY = 'bingo_active_room_code';
const LOCAL_ROOMS_CACHE_KEY = 'bingo_local_rooms_v2';
const BOT_NAMES = ['Bot Nova', 'Bot Pixel', 'Bot Cosmo', 'Bot Ziggy'];

function getSavedRoomsCache(): Record<string, RoomState> {
  try {
    const raw = localStorage.getItem(LOCAL_ROOMS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRoomToCache(code: string, room: RoomState | null) {
  try {
    const cache = getSavedRoomsCache();
    if (room) {
      cache[code] = room;
    } else {
      delete cache[code];
    }
    localStorage.setItem(LOCAL_ROOMS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota
  }
}

export function getSavedPlayerGrid(roomCode: string, uid: string, roundId: number): number[] | null {
  try {
    const raw = localStorage.getItem(`bingo_grid_${roomCode}_${uid}_${roundId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 25 && parsed.every((n) => typeof n === 'number')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function savePlayerGrid(roomCode: string, uid: string, roundId: number, grid: number[]) {
  try {
    localStorage.setItem(`bingo_grid_${roomCode}_${uid}_${roundId}`, JSON.stringify(grid));
  } catch {
    // Ignore
  }
}

export function useRoomSync(
  onToast?: (msg: string, type?: 'info' | 'warning' | 'success') => void,
  onPlayerJoinedSound?: () => void
) {
  const [uid, setUid] = useState<string>('');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myGrid, setMyGrid] = useState<(number | null)[]>(Array(25).fill(null));
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const [roomError, setRoomError] = useState<string | null>(null);

  // Strict turn lock: once you call a number on your turn, you cannot call another until next turn
  const hasCalledInCurrentTurnRef = useRef<boolean>(false);

  const serverTimeOffsetRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const activeRoomCodeRef = useRef<string | null>(null);
  const roomRefState = useRef<RoomState | null>(null);
  const prevPlayerCountRef = useRef<number>(0);
  const lastToastTimestampRef = useRef<number>(0);

  roomRefState.current = room;

  const getServerNow = useCallback(() => {
    return Date.now() + serverTimeOffsetRef.current;
  }, []);

  // Multi-tab heartbeating
  useEffect(() => {
    const updateHeartbeat = () => {
      localStorage.setItem('bingo_active_tab_heartbeat', String(Date.now()));
    };
    updateHeartbeat();
    const interval = setInterval(updateHeartbeat, 2000);
    return () => clearInterval(interval);
  }, []);

  // 1. Initialize UID
  useEffect(() => {
    let mounted = true;
    ensureAnonymousUser()
      .then((resolvedUid) => {
        if (mounted) {
          setUid(resolvedUid);
          setIsConnecting(false);
        }
      })
      .catch(() => {
        if (mounted) {
          const fallbackUid = 'uid_' + Math.random().toString(36).substring(2, 9);
          setUid(fallbackUid);
          setIsConnecting(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Reset turn lock when turn changes
  useEffect(() => {
    if (!room) return;
    if (room.currentTurnPlayerId !== uid) {
      hasCalledInCurrentTurnRef.current = false;
    }
  }, [room?.currentTurnPlayerId, uid]);

  // 2. WebSocket + BroadcastChannel sync
  useEffect(() => {
    if (isFirebaseConfigured() && db) return;

    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('bingo_realtime_sync_v2');
      bc.onmessage = (ev) => {
        const data = ev.data;
        if (data && data.type === 'room:value' && data.roomCode === activeRoomCodeRef.current) {
          handleIncomingRoomState(data.room);
        }
      };
      broadcastRef.current = bc;
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === LOCAL_ROOMS_CACHE_KEY && activeRoomCodeRef.current) {
        const cache = getSavedRoomsCache();
        const updated = cache[activeRoomCodeRef.current] || null;
        if (updated) {
          handleIncomingRoomState(updated);
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    const connectWs = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (activeRoomCodeRef.current && uid) {
            ws?.send(
              JSON.stringify({
                type: 'room:subscribe',
                roomCode: activeRoomCodeRef.current,
                playerId: uid,
              })
            );
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (typeof msg.serverTime === 'number') {
              serverTimeOffsetRef.current = msg.serverTime - Date.now();
            }
            if (msg.type === 'room:value' && msg.roomCode === activeRoomCodeRef.current) {
              if (msg.room) {
                saveRoomToCache(msg.roomCode, msg.room);
              }
              handleIncomingRoomState(msg.room);
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          if (!unmounted) {
            reconnectTimer = setTimeout(connectWs, 1500);
          }
        };
      } catch {
        if (!unmounted) {
          reconnectTimer = setTimeout(connectWs, 2000);
        }
      }
    };

    connectWs();

    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
      if (broadcastRef.current) broadcastRef.current.close();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [uid]);

  const handleIncomingRoomState = useCallback(
    (incoming: RoomState | null) => {
      if (!incoming) {
        if (activeRoomCodeRef.current) {
          activeRoomCodeRef.current = null;
          sessionStorage.removeItem(ACTIVE_ROOM_KEY);
          setRoom(null);
          onToast?.('The room was closed.', 'info');
        }
        return;
      }

      if (incoming.closedByHost && incoming.hostId !== uid) {
        activeRoomCodeRef.current = null;
        sessionStorage.removeItem(ACTIVE_ROOM_KEY);
        setRoom(null);
        onToast?.('The host closed the room.', 'warning');
        return;
      }

      const normalized: RoomState = {
        ...incoming,
        players: incoming.players || {},
        calledNumbers: incoming.calledNumbers || [],
        turnOrder: incoming.turnOrder || [],
      };

      const currentCount = Object.keys(normalized.players).length;
      if (
        prevPlayerCountRef.current > 0 &&
        currentCount > prevPlayerCountRef.current &&
        normalized.roomStatus === 'waiting'
      ) {
        onPlayerJoinedSound?.();
      }
      prevPlayerCountRef.current = currentCount;

      if (
        normalized.lastAction &&
        normalized.lastAction.timestamp > lastToastTimestampRef.current
      ) {
        lastToastTimestampRef.current = normalized.lastAction.timestamp;
        const act = normalized.lastAction;
        if (act.type === 'autopick' && act.number) {
          onToast?.(
            `Time's up! Auto-picked ${act.number}${act.playerName ? ` for ${act.playerName}` : ''}`,
            'warning'
          );
        } else if (act.type === 'leave' && act.playerName) {
          if (normalized.winReason === 'opponent_left') {
            onToast?.(`${act.playerName} left — You win by forfeit!`, 'warning');
          } else {
            onToast?.(`${act.playerName} left the game.`, 'info');
          }
        }
      }

      setRoom(normalized);
    },
    [uid, onToast, onPlayerJoinedSound]
  );

  // Firebase listener if configured
  useEffect(() => {
    const code = activeRoomCodeRef.current;
    if (!isFirebaseConfigured() || !db || !code || !uid) return;

    const roomDbRef = ref(db, `rooms/${code}`);
    const unsub = onValue(roomDbRef, (snapshot) => {
      const val = snapshot.val() as RoomState | null;
      handleIncomingRoomState(val);
    });

    const playerConnectedRef = ref(db, `rooms/${code}/players/${uid}/connected`);
    onDisconnect(playerConnectedRef).set(false);

    return () => {
      unsub();
    };
  }, [uid, room?.code, handleIncomingRoomState]);

  const publishFullRoom = useCallback(
    async (roomData: RoomState) => {
      const code = roomData.code;
      saveRoomToCache(code, roomData);
      setRoom(roomData);

      if (isFirebaseConfigured() && db) {
        await set(ref(db, `rooms/${code}`), roomData);
        return;
      }

      if (broadcastRef.current) {
        broadcastRef.current.postMessage({
          type: 'room:value',
          roomCode: code,
          room: roomData,
        });
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'room:set',
            roomCode: code,
            playerId: uid,
            room: roomData,
          })
        );
      }
    },
    [uid]
  );

  const patchRoom = useCallback(
    async (
      code: string,
      patch: Partial<RoomState> & {
        playerPatch?: { playerId: string; data: Partial<Player> };
      }
    ) => {
      const current = roomRefState.current;
      if (!current || current.code !== code) return;

      const { playerPatch, ...restPatch } = patch;
      const updated: RoomState = {
        ...current,
        ...restPatch,
        players: {
          ...current.players,
          ...(restPatch.players || {}),
        },
      };

      if (playerPatch) {
        const pid = playerPatch.playerId;
        if (updated.players[pid]) {
          updated.players[pid] = {
            ...updated.players[pid],
            ...playerPatch.data,
          };
        }
      }

      saveRoomToCache(code, updated);
      setRoom(updated);

      if (isFirebaseConfigured() && db) {
        if (playerPatch && Object.keys(patch).length === 1) {
          const { playerId, data } = playerPatch;
          await update(ref(db, `rooms/${code}/players/${playerId}`), data);
        } else {
          const fbPatch: Record<string, unknown> = { ...restPatch };
          if (playerPatch) {
            const { playerId, data } = playerPatch;
            Object.entries(data).forEach(([k, v]) => {
              fbPatch[`players/${playerId}/${k}`] = v;
            });
          }
          await update(ref(db, `rooms/${code}`), fbPatch);
        }
        return;
      }

      if (broadcastRef.current) {
        broadcastRef.current.postMessage({
          type: 'room:value',
          roomCode: code,
          room: updated,
        });
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'room:patch',
            roomCode: code,
            patch,
          })
        );
      }
    },
    []
  );

  const fetchRoomByCode = useCallback(async (code: string): Promise<RoomState | null> => {
    const cleanCode = code.trim().toUpperCase();
    if (isFirebaseConfigured() && db) {
      const snap = await get(ref(db, `rooms/${cleanCode}`));
      return snap.exists() ? (snap.val() as RoomState) : null;
    }

    try {
      const res = await fetch(`/api/rooms/${cleanCode}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.serverTime === 'number') {
          serverTimeOffsetRef.current = data.serverTime - Date.now();
        }
        if (data.room) {
          saveRoomToCache(cleanCode, data.room);
          return data.room as RoomState;
        }
      }
    } catch {
      // Fallback
    }

    const cache = getSavedRoomsCache();
    return cache[cleanCode] || null;
  }, []);

  // Rejoin on refresh
  useEffect(() => {
    if (!uid) return;
    const savedCode = sessionStorage.getItem(ACTIVE_ROOM_KEY);
    if (!savedCode || activeRoomCodeRef.current) return;

    fetchRoomByCode(savedCode).then((existing) => {
      if (existing && existing.players && existing.players[uid] && !existing.closedByHost) {
        activeRoomCodeRef.current = savedCode;
        const savedGrid = getSavedPlayerGrid(savedCode, uid, existing.createdAt);
        if (savedGrid) {
          setMyGrid(savedGrid);
        }
        existing.players[uid].connected = true;
        handleIncomingRoomState(existing);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'room:subscribe',
              roomCode: savedCode,
              playerId: uid,
            })
          );
        }
        patchRoom(savedCode, {
          playerPatch: { playerId: uid, data: { connected: true } },
        });
      } else {
        sessionStorage.removeItem(ACTIVE_ROOM_KEY);
      }
    });
  }, [uid, fetchRoomByCode, handleIncomingRoomState, patchRoom]);

  // Create Room
  const createRoom = useCallback(
    async (playerName: string): Promise<boolean> => {
      if (!uid) return false;
      setRoomError(null);

      let code = generateRoomCodeString();
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await fetchRoomByCode(code);
        if (!existing) break;
        code = generateRoomCodeString();
      }

      const now = getServerNow();
      const cleanName = playerName.trim().slice(0, 12) || 'Player 1';

      const hostPlayer: Player = {
        id: uid,
        name: cleanName,
        avatarColor: pickAvatarColor(0),
        avatarIcon: pickAvatarIcon(0),
        ready: true,
        gridReady: false,
        playAgainReady: false,
        connected: true,
        linesCompleted: 0,
        bingoAtCallCount: null,
        lastEvaluatedCallCount: 0,
        finishedRank: null,
        joinedAt: now,
      };

      const newRoom: RoomState = {
        code,
        hostId: uid,
        maxPlayers: 2,
        roomStatus: 'waiting',
        players: { [uid]: hostPlayer },
        calledNumbers: [],
        turnOrder: [uid],
        currentTurnPlayerId: null,
        turnDeadline: null,
        setupDeadline: null,
        lastAction: null,
        winReason: null,
        createdAt: now,
      };

      activeRoomCodeRef.current = code;
      prevPlayerCountRef.current = 1;
      sessionStorage.setItem(ACTIVE_ROOM_KEY, code);
      setMyGrid(Array(25).fill(null));

      await publishFullRoom(newRoom);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'room:subscribe',
            roomCode: code,
            playerId: uid,
          })
        );
      }
      return true;
    },
    [uid, fetchRoomByCode, getServerNow, publishFullRoom]
  );

  // Join Room
  const joinRoom = useCallback(
    async (
      playerName: string,
      codeInput: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!uid) return { ok: false, error: 'Connecting, please try again.' };
      const code = codeInput.trim().toUpperCase();

      if (!isValidRoomCodeFormat(code)) {
        const err = 'Invalid code! Must be 5 letters/digits (no O/0 or I/1).';
        setRoomError(err);
        return { ok: false, error: err };
      }

      const existing = await fetchRoomByCode(code);
      if (!existing || existing.closedByHost) {
        const err = 'Room not found! Check the code and try again.';
        setRoomError(err);
        return { ok: false, error: err };
      }

      const playersList = Object.values(existing.players || {});
      const isRejoining = Boolean(existing.players && existing.players[uid]);

      if (!isRejoining) {
        if (existing.roomStatus !== 'waiting') {
          const err = 'Game already started in this room!';
          setRoomError(err);
          return { ok: false, error: err };
        }
        if (playersList.length >= existing.maxPlayers) {
          const err = `Room is full! (${existing.maxPlayers}/${existing.maxPlayers} players)`;
          setRoomError(err);
          return { ok: false, error: err };
        }
      }

      const uniqueName = resolveUniquePlayerName(playerName, existing.players || {}, uid);
      const now = getServerNow();

      const myPlayer: Player = isRejoining
        ? {
            ...existing.players[uid],
            name: uniqueName,
            connected: true,
          }
        : {
            id: uid,
            name: uniqueName,
            avatarColor: pickAvatarColor(playersList.length),
            avatarIcon: pickAvatarIcon(playersList.length),
            ready: false,
            gridReady: false,
            playAgainReady: false,
            connected: true,
            linesCompleted: 0,
            bingoAtCallCount: null,
            lastEvaluatedCallCount: 0,
            finishedRank: null,
            joinedAt: now,
          };

      const updatedRoom: RoomState = {
        ...existing,
        players: {
          ...existing.players,
          [uid]: myPlayer,
        },
      };

      activeRoomCodeRef.current = code;
      prevPlayerCountRef.current = Object.keys(updatedRoom.players).length;
      sessionStorage.setItem(ACTIVE_ROOM_KEY, code);
      setRoomError(null);

      const savedGrid = getSavedPlayerGrid(code, uid, existing.createdAt);
      setMyGrid(savedGrid || Array(25).fill(null));

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'room:subscribe',
            roomCode: code,
            playerId: uid,
          })
        );
      }

      await publishFullRoom(updatedRoom);
      onPlayerJoinedSound?.();
      return { ok: true };
    },
    [uid, fetchRoomByCode, getServerNow, publishFullRoom, onPlayerJoinedSound]
  );

  // Leave Room
  const leaveRoom = useCallback(async () => {
    const current = roomRefState.current;
    const code = activeRoomCodeRef.current;
    activeRoomCodeRef.current = null;
    sessionStorage.removeItem(ACTIVE_ROOM_KEY);
    setRoom(null);
    setMyGrid(Array(25).fill(null));

    if (!current || !code || !uid) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:leave',
          roomCode: code,
          playerId: uid,
        })
      );
    }

    if (current.roomStatus === 'waiting') {
      if (current.hostId === uid) {
        const closedState: RoomState = { ...current, closedByHost: true };
        await publishFullRoom(closedState);
        saveRoomToCache(code, null);
      } else {
        const remainingPlayers = { ...current.players };
        delete remainingPlayers[uid];
        await publishFullRoom({ ...current, players: remainingPlayers });
      }
    } else {
      const updatedPlayers = { ...current.players };
      if (updatedPlayers[uid]) {
        updatedPlayers[uid] = { ...updatedPlayers[uid], connected: false };
      }
      const activeConnected = Object.values(updatedPlayers).filter((p) => p.connected);
      const updatedTurnOrder = (current.turnOrder || []).filter((id) => id !== uid);

      let nextStatus = current.roomStatus;
      let winReason = current.winReason;
      let nextTurn = current.currentTurnPlayerId;
      let nextDeadline = current.turnDeadline;

      if (current.roomStatus === 'setup' || current.roomStatus === 'playing') {
        if (activeConnected.length <= 1) {
          nextStatus = 'finished';
          winReason = 'opponent_left';
          nextTurn = null;
          nextDeadline = null;
          if (activeConnected.length === 1) {
            updatedPlayers[activeConnected[0].id] = {
              ...updatedPlayers[activeConnected[0].id],
              finishedRank: 1,
            };
          }
        } else if (current.currentTurnPlayerId === uid) {
          const unfinished = activeConnected.filter((p) => p.linesCompleted < 5);
          nextTurn = unfinished.length > 0 ? unfinished[0].id : null;
          nextDeadline = getServerNow() + 15000;
        }
      }

      await publishFullRoom({
        ...current,
        roomStatus: nextStatus,
        winReason,
        players: updatedPlayers,
        turnOrder: updatedTurnOrder,
        currentTurnPlayerId: nextTurn,
        turnDeadline: nextDeadline,
        lastAction: {
          type: 'leave',
          playerId: uid,
          playerName: current.players[uid]?.name || 'Player',
          timestamp: getServerNow(),
        },
      });
    }
  }, [uid, getServerNow, publishFullRoom]);

  // Host changes capacity: 2, 3, 4
  const setMaxPlayers = useCallback(
    async (maxPlayers: 2 | 3 | 4) => {
      const current = roomRefState.current;
      if (!current || current.hostId !== uid || current.roomStatus !== 'waiting') return;
      const currentCount = Object.keys(current.players).length;
      if (maxPlayers < currentCount) {
        onToast?.(`Cannot set to ${maxPlayers}; room already has ${currentCount} players`, 'warning');
        return;
      }
      await patchRoom(current.code, { maxPlayers });
    },
    [uid, patchRoom, onToast]
  );

  // Toggle ready in Waiting Room
  const toggleWaitingReady = useCallback(async () => {
    const current = roomRefState.current;
    if (!current || !current.players[uid] || current.roomStatus !== 'waiting') return;
    const nextReady = !current.players[uid].ready;
    await patchRoom(current.code, {
      playerPatch: { playerId: uid, data: { ready: nextReady } },
    });
  }, [uid, patchRoom]);

  // Add Test Bot (Rock-solid implementation as requested)
  const addBotPlayer = useCallback(async () => {
    const current = roomRefState.current;
    if (!current || current.hostId !== uid || current.roomStatus !== 'waiting') return;
    const playersList = Object.values(current.players);
    if (playersList.length >= current.maxPlayers) {
      onToast?.(`Room is full (${current.maxPlayers}/${current.maxPlayers}). Increase player limit first.`, 'warning');
      return;
    }

    const botIndex = playersList.filter((p) => p.isBot).length;
    const botId = `bot_${Date.now().toString(36)}_${botIndex + 1}`;
    const rawBotName = BOT_NAMES[botIndex % BOT_NAMES.length];
    const botName = resolveUniquePlayerName(rawBotName, current.players, botId);

    const botPlayer: Player = {
      id: botId,
      name: botName,
      avatarColor: pickAvatarColor(playersList.length),
      avatarIcon: '🤖',
      ready: true,
      gridReady: true,
      playAgainReady: true,
      connected: true,
      linesCompleted: 0,
      bingoAtCallCount: null,
      lastEvaluatedCallCount: 0,
      finishedRank: null,
      joinedAt: getServerNow(),
      isBot: true,
    };

    const updatedPlayers = {
      ...current.players,
      [botId]: botPlayer,
    };

    await publishFullRoom({
      ...current,
      players: updatedPlayers,
    });
    onPlayerJoinedSound?.();
    onToast?.(`Added ${botName} to room!`, 'success');
  }, [uid, getServerNow, publishFullRoom, onPlayerJoinedSound, onToast]);

  // Remove Bot
  const removeBotPlayer = useCallback(
    async (botId: string) => {
      const current = roomRefState.current;
      if (!current || current.hostId !== uid || current.roomStatus !== 'waiting') return;
      const updatedPlayers = { ...current.players };
      const botName = updatedPlayers[botId]?.name || 'Bot';
      delete updatedPlayers[botId];
      await publishFullRoom({
        ...current,
        players: updatedPlayers,
      });
      onToast?.(`Removed ${botName}`, 'info');
    },
    [uid, publishFullRoom, onToast]
  );

  // Start Grid Setup
  const startGridSetup = useCallback(async () => {
    const current = roomRefState.current;
    if (!current || current.hostId !== uid || current.roomStatus !== 'waiting') return;

    const playersList = Object.values(current.players);
    if (playersList.length < current.maxPlayers) return;
    if (!playersList.every((p) => p.ready)) return;

    const now = getServerNow();
    const updatedPlayers: Record<string, Player> = {};
    playersList.forEach((p) => {
      updatedPlayers[p.id] = {
        ...p,
        gridReady: Boolean(p.isBot),
        playAgainReady: false,
        linesCompleted: 0,
        bingoAtCallCount: null,
        lastEvaluatedCallCount: 0,
        finishedRank: null,
      };
    });

    setMyGrid(Array(25).fill(null));

    await publishFullRoom({
      ...current,
      roomStatus: 'setup',
      setupDeadline: now + 45000,
      calledNumbers: [],
      players: updatedPlayers,
      winReason: null,
      lastAction: {
        type: 'start',
        timestamp: now,
      },
    });
  }, [uid, getServerNow, publishFullRoom]);

  // Transition to Playing
  const startPlayingPhase = useCallback(
    async (roomSnapshot: RoomState) => {
      const connectedPlayers = Object.values(roomSnapshot.players)
        .filter((p) => p.connected)
        .sort((a, b) => a.joinedAt - b.joinedAt);

      if (connectedPlayers.length === 0) return;

      const turnOrder = connectedPlayers.map((p) => p.id);
      const randomStartIndex = Math.floor(Math.random() * turnOrder.length);
      const rotatedTurnOrder = [
        ...turnOrder.slice(randomStartIndex),
        ...turnOrder.slice(0, randomStartIndex),
      ];

      const now = getServerNow();
      await patchRoom(roomSnapshot.code, {
        roomStatus: 'playing',
        turnOrder: rotatedTurnOrder,
        currentTurnPlayerId: rotatedTurnOrder[0],
        turnDeadline: now + 15000,
        setupDeadline: null,
      });
    },
    [getServerNow, patchRoom]
  );

  // Confirm Grid Ready
  const confirmGridReady = useCallback(
    async (completedGrid: number[]) => {
      const current = roomRefState.current;
      if (!current || !uid || current.roomStatus !== 'setup') return;

      setMyGrid(completedGrid);
      savePlayerGrid(current.code, uid, current.createdAt, completedGrid);

      const updatedPlayers: Record<string, Player> = {
        ...current.players,
        [uid]: {
          ...current.players[uid],
          gridReady: true,
        },
      };

      const allReady = Object.values(updatedPlayers)
        .filter((p) => p.connected)
        .every((p) => p.gridReady);

      if (allReady) {
        const connectedPlayers = Object.values(updatedPlayers)
          .filter((p) => p.connected)
          .sort((a, b) => a.joinedAt - b.joinedAt);
        const turnOrder = connectedPlayers.map((p) => p.id);
        const randomIdx = Math.floor(Math.random() * turnOrder.length);
        const rotatedTurnOrder = [
          ...turnOrder.slice(randomIdx),
          ...turnOrder.slice(0, randomIdx),
        ];
        const now = getServerNow();

        await publishFullRoom({
          ...current,
          roomStatus: 'playing',
          players: updatedPlayers,
          turnOrder: rotatedTurnOrder,
          currentTurnPlayerId: rotatedTurnOrder[0],
          turnDeadline: now + 15000,
          setupDeadline: null,
        });
      } else {
        await patchRoom(current.code, {
          playerPatch: { playerId: uid, data: { gridReady: true } },
        });
      }
    },
    [uid, getServerNow, publishFullRoom, patchRoom]
  );

  // Host starts game if all ready
  useEffect(() => {
    if (!room || room.roomStatus !== 'setup' || room.hostId !== uid) return;
    const connected = Object.values(room.players).filter((p) => p.connected);
    if (connected.length >= 2 && connected.every((p) => p.gridReady)) {
      const timer = setTimeout(() => {
        if (roomRefState.current?.roomStatus === 'setup') {
          startPlayingPhase(roomRefState.current);
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [room, uid, startPlayingPhase]);

  // Private Grid Line Evaluation on calledNumbers changes
  useEffect(() => {
    if (!room || room.roomStatus !== 'playing' || !uid) return;
    const me = room.players[uid];
    if (!me) return;

    const validGrid = myGrid.every((n): n is number => typeof n === 'number' && n >= 1 && n <= 25);
    if (!validGrid) return;

    const callCount = room.calledNumbers.length;
    const { linesCount } = evaluateGridLines(myGrid, room.calledNumbers);

    const newBingoAtCallCount =
      linesCount >= 5
        ? me.bingoAtCallCount !== null
          ? me.bingoAtCallCount
          : callCount
        : null;

    const isHost = room.hostId === uid;
    const updatedPlayers: Record<string, Player> = { ...room.players };
    let anyChanged = false;

    if (
      me.linesCompleted !== linesCount ||
      me.lastEvaluatedCallCount !== callCount ||
      me.bingoAtCallCount !== newBingoAtCallCount
    ) {
      updatedPlayers[uid] = {
        ...me,
        linesCompleted: linesCount,
        lastEvaluatedCallCount: callCount,
        bingoAtCallCount: newBingoAtCallCount,
      };
      anyChanged = true;
    }

    if (isHost) {
      Object.values(room.players).forEach((p) => {
        if (p.isBot && p.connected) {
          const botGrid = generateSeededGrid(`${room.code}_${p.id}_${room.createdAt}`);
          const { linesCount: botLines } = evaluateGridLines(botGrid, room.calledNumbers);
          const botBingoAt =
            botLines >= 5
              ? p.bingoAtCallCount !== null
                ? p.bingoAtCallCount
                : callCount
              : null;

          if (
            p.linesCompleted !== botLines ||
            p.lastEvaluatedCallCount !== callCount ||
            p.bingoAtCallCount !== botBingoAt
          ) {
            updatedPlayers[p.id] = {
              ...p,
              linesCompleted: botLines,
              lastEvaluatedCallCount: callCount,
              bingoAtCallCount: botBingoAt,
            };
            anyChanged = true;
          }
        }
      });
    }

    const connectedPlayers = Object.values(updatedPlayers).filter((p) => p.connected);
    const allEvaluated = connectedPlayers.every((p) => p.lastEvaluatedCallCount >= callCount);

    if (allEvaluated && callCount > 0) {
      const { updatedRanks, isGameOver, nextActivePlayers } =
        computeRankingsAndGameOver(updatedPlayers);

      connectedPlayers.forEach((p) => {
        if (updatedPlayers[p.id].finishedRank !== updatedRanks[p.id]) {
          updatedPlayers[p.id] = {
            ...updatedPlayers[p.id],
            finishedRank: updatedRanks[p.id],
          };
          anyChanged = true;
        }
      });

      if (isGameOver) {
        publishFullRoom({
          ...room,
          roomStatus: 'finished',
          winReason: 'bingo',
          players: updatedPlayers,
          currentTurnPlayerId: null,
          turnDeadline: null,
        });
        return;
      }

      const activeSet = new Set(nextActivePlayers);
      const filteredTurnOrder = room.turnOrder.filter((id) => activeSet.has(id));
      let nextTurnId = room.currentTurnPlayerId;
      let nextDeadline = room.turnDeadline;

      if (nextTurnId && !activeSet.has(nextTurnId) && filteredTurnOrder.length > 0) {
        const oldIdx = room.turnOrder.indexOf(nextTurnId);
        let foundNext: string | null = null;
        for (let offset = 1; offset <= room.turnOrder.length; offset++) {
          const candidate = room.turnOrder[(oldIdx + offset) % room.turnOrder.length];
          if (activeSet.has(candidate)) {
            foundNext = candidate;
            break;
          }
        }
        nextTurnId = foundNext || filteredTurnOrder[0];
        nextDeadline = getServerNow() + 15000;
        anyChanged = true;
      }

      if (anyChanged || filteredTurnOrder.length !== room.turnOrder.length) {
        patchRoom(room.code, {
          players: updatedPlayers,
          turnOrder: filteredTurnOrder,
          currentTurnPlayerId: nextTurnId,
          turnDeadline: nextDeadline,
        });
      }
    } else if (anyChanged) {
      if (isHost) {
        patchRoom(room.code, { players: updatedPlayers });
      } else {
        patchRoom(room.code, {
          playerPatch: { playerId: uid, data: updatedPlayers[uid] },
        });
      }
    }
  }, [
    room?.calledNumbers.length,
    room?.roomStatus,
    room?.players,
    myGrid,
    uid,
    getServerNow,
    patchRoom,
    publishFullRoom,
  ]);

  // Call a number with strict single-tap lock
  const callNumber = useCallback(
    async (num: number, isAutoPick = false, actingPlayerId?: string) => {
      const current = roomRefState.current;
      if (!current || current.roomStatus !== 'playing') return;
      const callerId = actingPlayerId || uid;

      // Ensure caller is the active turn player
      if (current.currentTurnPlayerId !== callerId) return;
      if (current.calledNumbers.includes(num)) return;

      // Strict user input guard: block rapid second taps until turn rotates
      if (callerId === uid && !isAutoPick) {
        if (hasCalledInCurrentTurnRef.current) return;
        hasCalledInCurrentTurnRef.current = true;
      }

      const nextCalledNumbers = [...current.calledNumbers, num];
      const callCount = nextCalledNumbers.length;
      const now = getServerNow();

      const updatedPlayers: Record<string, Player> = { ...current.players };

      if (callerId === uid && myGrid.every((n): n is number => typeof n === 'number')) {
        const { linesCount } = evaluateGridLines(myGrid, nextCalledNumbers);
        const me = updatedPlayers[uid];
        if (me) {
          updatedPlayers[uid] = {
            ...me,
            linesCompleted: linesCount,
            lastEvaluatedCallCount: callCount,
            bingoAtCallCount:
              linesCount >= 5
                ? me.bingoAtCallCount !== null
                  ? me.bingoAtCallCount
                  : callCount
                : null,
          };
        }
      }

      if (current.hostId === uid || updatedPlayers[callerId]?.isBot) {
        Object.values(updatedPlayers).forEach((p) => {
          if (p.isBot && p.connected) {
            const botGrid = generateSeededGrid(`${current.code}_${p.id}_${current.createdAt}`);
            const { linesCount: botLines } = evaluateGridLines(botGrid, nextCalledNumbers);
            updatedPlayers[p.id] = {
              ...p,
              linesCompleted: botLines,
              lastEvaluatedCallCount: callCount,
              bingoAtCallCount:
                botLines >= 5
                  ? p.bingoAtCallCount !== null
                    ? p.bingoAtCallCount
                    : callCount
                  : null,
            };
          }
        });
      }

      const activeTurnOrder = current.turnOrder.filter((pid) => {
        const p = updatedPlayers[pid];
        return p && p.connected && p.linesCompleted < 5;
      });

      let nextTurnPlayerId: string | null = null;
      if (activeTurnOrder.length > 0) {
        const oldIdx = current.turnOrder.indexOf(callerId);
        for (let offset = 1; offset <= current.turnOrder.length; offset++) {
          const candidate = current.turnOrder[(oldIdx + offset) % current.turnOrder.length];
          if (activeTurnOrder.includes(candidate)) {
            nextTurnPlayerId = candidate;
            break;
          }
        }
        if (!nextTurnPlayerId) {
          nextTurnPlayerId = activeTurnOrder[0];
        }
      }

      const callerName = current.players[callerId]?.name || 'Player';

      await publishFullRoom({
        ...current,
        calledNumbers: nextCalledNumbers,
        players: updatedPlayers,
        turnOrder: activeTurnOrder,
        currentTurnPlayerId: nextTurnPlayerId,
        turnDeadline: now + 15000,
        lastAction: {
          type: isAutoPick ? 'autopick' : 'call',
          playerId: callerId,
          playerName: callerName,
          number: num,
          timestamp: now,
        },
      });
    },
    [uid, myGrid, getServerNow, publishFullRoom]
  );

  // Bot Turn execution with realistic 1.5s to 2s delay as requested!
  useEffect(() => {
    if (!room || room.roomStatus !== 'playing' || !room.currentTurnPlayerId) return;
    if (room.hostId !== uid) return;

    const currentTurnPlayer = room.players[room.currentTurnPlayerId];
    if (!currentTurnPlayer || !currentTurnPlayer.isBot) return;

    // 1.6 to 2.0 second natural bot thinking delay
    const botDelay = 1600 + Math.random() * 400;

    const timer = setTimeout(() => {
      const latest = roomRefState.current;
      if (
        !latest ||
        latest.roomStatus !== 'playing' ||
        latest.currentTurnPlayerId !== currentTurnPlayer.id
      ) {
        return;
      }
      const botGrid = generateSeededGrid(
        `${latest.code}_${currentTurnPlayer.id}_${latest.createdAt}`
      );
      const chosen =
        pickSmartBotNumber(botGrid, latest.calledNumbers) ??
        pickRandomUncalledNumber(latest.calledNumbers);
      if (chosen !== null) {
        callNumber(chosen, false, currentTurnPlayer.id);
      }
    }, botDelay);

    return () => clearTimeout(timer);
  }, [room?.currentTurnPlayerId, room?.roomStatus, room?.calledNumbers.length, room?.hostId, uid, callNumber]);

  // Auto-pick on 15s timeout
  useEffect(() => {
    if (!room || room.roomStatus !== 'playing' || !room.turnDeadline || !room.currentTurnPlayerId) {
      return;
    }

    const interval = setInterval(() => {
      const latest = roomRefState.current;
      if (
        !latest ||
        latest.roomStatus !== 'playing' ||
        !latest.turnDeadline ||
        !latest.currentTurnPlayerId
      ) {
        return;
      }

      const now = getServerNow();
      const currentTurnId = latest.currentTurnPlayerId;
      const isMyTurn = currentTurnId === uid;
      const isHost = latest.hostId === uid;
      const turnPlayerConnected = latest.players[currentTurnId]?.connected;

      if (isMyTurn && now >= latest.turnDeadline) {
        const randomNum = pickRandomUncalledNumber(latest.calledNumbers);
        if (randomNum !== null) {
          callNumber(randomNum, true, uid);
        }
      } else if (
        isHost &&
        ((!turnPlayerConnected && now >= latest.turnDeadline) ||
          now >= latest.turnDeadline + 2000)
      ) {
        const randomNum = pickRandomUncalledNumber(latest.calledNumbers);
        if (randomNum !== null) {
          callNumber(randomNum, true, currentTurnId);
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [room?.roomStatus, room?.turnDeadline, room?.currentTurnPlayerId, uid, getServerNow, callNumber]);

  // Play Again (rematch in same room)
  const requestPlayAgain = useCallback(async () => {
    const current = roomRefState.current;
    if (!current || !uid || current.roomStatus !== 'finished') return;

    const updatedPlayers: Record<string, Player> = { ...current.players };
    if (updatedPlayers[uid]) {
      updatedPlayers[uid] = {
        ...updatedPlayers[uid],
        playAgainReady: true,
      };
    }
    Object.values(updatedPlayers).forEach((p) => {
      if (p.isBot) {
        updatedPlayers[p.id] = { ...p, playAgainReady: true };
      }
    });

    const connectedPlayers = Object.values(updatedPlayers).filter((p) => p.connected);
    const allReadyToPlayAgain =
      connectedPlayers.length >= 2 && connectedPlayers.every((p) => p.playAgainReady);

    if (allReadyToPlayAgain) {
      const now = getServerNow();
      const resetPlayers: Record<string, Player> = {};
      Object.values(updatedPlayers).forEach((p) => {
        if (p.connected) {
          resetPlayers[p.id] = {
            ...p,
            ready: true,
            gridReady: Boolean(p.isBot),
            playAgainReady: false,
            linesCompleted: 0,
            bingoAtCallCount: null,
            lastEvaluatedCallCount: 0,
            finishedRank: null,
          };
        }
      });

      setMyGrid(Array(25).fill(null));
      hasCalledInCurrentTurnRef.current = false;

      await publishFullRoom({
        ...current,
        roomStatus: 'setup',
        setupDeadline: now + 45000,
        calledNumbers: [],
        turnOrder: Object.keys(resetPlayers),
        currentTurnPlayerId: null,
        turnDeadline: null,
        winReason: null,
        lastAction: {
          type: 'start',
          timestamp: now,
        },
        createdAt: now,
        players: resetPlayers,
      });
    } else {
      await patchRoom(current.code, {
        players: updatedPlayers,
      });
    }
  }, [uid, getServerNow, publishFullRoom, patchRoom]);

  const updateMyNameInRoom = useCallback(
    async (newName: string) => {
      const current = roomRefState.current;
      if (!current || !uid || !current.players[uid]) return;
      const uniqueName = resolveUniquePlayerName(newName, current.players, uid);
      await patchRoom(current.code, {
        playerPatch: { playerId: uid, data: { name: uniqueName } },
      });
    },
    [uid, patchRoom]
  );

  return {
    uid,
    room,
    myGrid,
    setMyGrid,
    isConnecting,
    roomError,
    setRoomError,
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
  };
}
