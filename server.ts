import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Player {
  id: string;
  name: string;
  avatarColor: string;
  avatarIcon: string;
  ready: boolean;
  gridReady: boolean;
  playAgainReady: boolean;
  connected: boolean;
  linesCompleted: number;
  bingoAtCallCount: number | null;
  lastEvaluatedCallCount: number;
  finishedRank: number | null;
  joinedAt: number;
  isBot?: boolean;
}

interface RoomState {
  code: string;
  hostId: string;
  maxPlayers: 2 | 3 | 4;
  roomStatus: 'waiting' | 'setup' | 'playing' | 'finished';
  players: Record<string, Player>;
  calledNumbers: number[];
  turnOrder: string[];
  currentTurnPlayerId: string | null;
  turnDeadline: number | null;
  setupDeadline: number | null;
  lastAction: {
    type: 'call' | 'autopick' | 'leave' | 'start' | 'bingo';
    playerId?: string;
    playerName?: string;
    number?: number;
    timestamp: number;
  } | null;
  winReason: 'bingo' | 'opponent_left' | null;
  closedByHost?: boolean;
  createdAt: number;
}

const rooms = new Map<string, RoomState>();

interface ClientMeta {
  ws: WebSocket;
  roomCode: string | null;
  playerId: string | null;
}

const clients = new Map<WebSocket, ClientMeta>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();

function broadcastRoom(roomCode: string) {
  const room = rooms.get(roomCode);
  const payload = JSON.stringify({
    type: 'room:value',
    roomCode,
    room: room || null,
    serverTime: Date.now(),
  });

  for (const [, meta] of clients) {
    if (meta.roomCode === roomCode && meta.ws.readyState === WebSocket.OPEN) {
      meta.ws.send(payload);
    }
  }
}

function handlePlayerDisconnect(roomCode: string, playerId: string, immediate = false) {
  const key = `${roomCode}:${playerId}`;
  if (disconnectTimers.has(key)) {
    clearTimeout(disconnectTimers.get(key)!);
    disconnectTimers.delete(key);
  }

  const executeDisconnect = () => {
    disconnectTimers.delete(key);
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.players[playerId];
    if (!player) return;

    if (!immediate) {
      for (const [, meta] of clients) {
        if (
          meta.roomCode === roomCode &&
          meta.playerId === playerId &&
          meta.ws.readyState === WebSocket.OPEN
        ) {
          return; // Reconnected!
        }
      }
    }

    if (room.roomStatus === 'waiting') {
      if (room.hostId === playerId) {
        room.closedByHost = true;
        broadcastRoom(roomCode);
        setTimeout(() => {
          rooms.delete(roomCode);
        }, 2000);
        return;
      } else {
        delete room.players[playerId];
        broadcastRoom(roomCode);
        return;
      }
    }

    player.connected = false;
    room.turnOrder = (room.turnOrder || []).filter((id) => id !== playerId);

    const connectedHumans = Object.values(room.players).filter(
      (p) => p.connected && !p.isBot
    );
    if (connectedHumans.length === 0) {
      setTimeout(() => {
        const cur = rooms.get(roomCode);
        if (
          cur &&
          Object.values(cur.players).every((p) => !p.connected || p.isBot)
        ) {
          rooms.delete(roomCode);
        }
      }, 30000);
      return;
    }

    if (room.hostId === playerId && connectedHumans.length > 0) {
      room.hostId = connectedHumans[0].id;
    }

    const activePlayers = Object.values(room.players).filter((p) => p.connected);

    if (room.roomStatus === 'setup' || room.roomStatus === 'playing') {
      if (activePlayers.length <= 1) {
        room.roomStatus = 'finished';
        room.winReason = 'opponent_left';
        room.currentTurnPlayerId = null;
        room.turnDeadline = null;
        room.lastAction = {
          type: 'leave',
          playerId,
          playerName: player.name,
          timestamp: Date.now(),
        };
        if (activePlayers.length === 1) {
          activePlayers[0].finishedRank = 1;
        }
        broadcastRoom(roomCode);
        return;
      }

      if (room.roomStatus === 'playing' && room.currentTurnPlayerId === playerId) {
        const unfinishedActive = activePlayers.filter((p) => p.linesCompleted < 5);
        if (unfinishedActive.length > 0) {
          room.currentTurnPlayerId = unfinishedActive[0].id;
          room.turnDeadline = Date.now() + 15000;
        }
      }

      room.lastAction = {
        type: 'leave',
        playerId,
        playerName: player.name,
        timestamp: Date.now(),
      };
    }

    broadcastRoom(roomCode);
  };

  if (immediate) {
    executeDisconnect();
  } else {
    const timer = setTimeout(executeDisconnect, 2000);
    disconnectTimers.set(key, timer);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  app.get('/api/rooms/:code', (req, res) => {
    const code = (req.params.code || '').toUpperCase();
    const room = rooms.get(code) || null;
    res.json({ room, serverTime: Date.now() });
  });

  wss.on('connection', (ws) => {
    clients.set(ws, { ws, roomCode: null, playerId: null });
    ws.send(JSON.stringify({ type: 'server:hello', serverTime: Date.now() }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const meta = clients.get(ws);
        if (!meta) return;

        switch (msg.type) {
          case 'room:subscribe': {
            const code = (msg.roomCode || '').toUpperCase();
            const playerId = msg.playerId || null;
            meta.roomCode = code;
            if (playerId) {
              meta.playerId = playerId;
              const key = `${code}:${playerId}`;
              if (disconnectTimers.has(key)) {
                clearTimeout(disconnectTimers.get(key)!);
                disconnectTimers.delete(key);
              }
              const existing = rooms.get(code);
              if (existing && existing.players[playerId]) {
                existing.players[playerId].connected = true;
                if (
                  existing.roomStatus === 'playing' &&
                  existing.players[playerId].linesCompleted < 5 &&
                  !existing.turnOrder.includes(playerId)
                ) {
                  existing.turnOrder.push(playerId);
                }
                broadcastRoom(code);
                break;
              }
            }
            const room = rooms.get(code) || null;
            ws.send(
              JSON.stringify({
                type: 'room:value',
                roomCode: code,
                room,
                serverTime: Date.now(),
              })
            );
            break;
          }

          case 'room:set': {
            const code = (msg.roomCode || '').toUpperCase();
            const roomData: RoomState = msg.room;
            if (code && roomData) {
              rooms.set(code, roomData);
              meta.roomCode = code;
              if (msg.playerId) meta.playerId = msg.playerId;
              broadcastRoom(code);
            }
            break;
          }

          case 'room:patch': {
            const code = (msg.roomCode || '').toUpperCase();
            const existing = rooms.get(code);
            if (!existing) break;

            const patch = msg.patch || {};
            const { playerPatch, ...restPatch } = patch;
            Object.assign(existing, restPatch);

            if (restPatch.players) {
              existing.players = { ...existing.players, ...restPatch.players };
            }

            if (playerPatch && playerPatch.playerId) {
              const pid = playerPatch.playerId;
              if (existing.players[pid]) {
                existing.players[pid] = {
                  ...existing.players[pid],
                  ...playerPatch.data,
                };
              }
            }

            rooms.set(code, existing);
            broadcastRoom(code);
            break;
          }

          case 'room:leave': {
            const code = (msg.roomCode || '').toUpperCase();
            const playerId = msg.playerId || meta.playerId;
            if (code && playerId) {
              handlePlayerDisconnect(code, playerId, true);
            }
            if (meta.roomCode === code) {
              meta.roomCode = null;
            }
            break;
          }
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      const meta = clients.get(ws);
      clients.delete(ws);
      if (meta && meta.roomCode && meta.playerId) {
        handlePlayerDisconnect(meta.roomCode, meta.playerId, false);
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`B.I.N.G.O! server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
