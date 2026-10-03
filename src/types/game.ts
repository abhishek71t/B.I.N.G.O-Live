export type RoomStatus = 'waiting' | 'setup' | 'playing' | 'finished';

export interface Player {
  id: string;
  name: string;
  avatarColor: string;
  avatarIcon: string; // Non-blinking clean symbol/letter identifier
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

export interface LastRoomAction {
  type: 'call' | 'autopick' | 'leave' | 'start' | 'bingo';
  playerId?: string;
  playerName?: string;
  number?: number;
  timestamp: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  maxPlayers: 2 | 3 | 4;
  roomStatus: RoomStatus;
  players: Record<string, Player>;
  calledNumbers: number[];
  turnOrder: string[];
  currentTurnPlayerId: string | null;
  turnDeadline: number | null;
  setupDeadline: number | null;
  lastAction: LastRoomAction | null;
  winReason: 'bingo' | 'opponent_left' | null;
  closedByHost?: boolean;
  createdAt: number;
}

export interface CompletedLine {
  type: 'row' | 'col' | 'diag';
  index: number;
  cells: number[];
}

export interface UserPreferences {
  playerName: string;
  soundEnabled: boolean;
  volume: number;
  vibrationEnabled: boolean;
}
