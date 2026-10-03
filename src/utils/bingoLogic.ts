import { CompletedLine, Player } from '../types/game';

// Unambiguous 5-character alphabet (no O/0, no I/1)
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const AVATAR_COLORS = [
  '#F43F5E', // Rose
  '#8B5CF6', // Violet
  '#0EA5E9', // Sky
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
];

export const AVATAR_ICONS = ['⭐', '🦊', '🚀', '🐼', '🐯', '⚡', '🍀', '🎯'];

export function generateRoomCodeString(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[idx];
  }
  return code;
}

export function isValidRoomCodeFormat(code: string): boolean {
  const cleaned = code.trim().toUpperCase();
  if (cleaned.length !== 5) return false;
  for (const ch of cleaned) {
    if (!ROOM_CODE_CHARS.includes(ch)) return false;
  }
  return true;
}

export function pickAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function pickAvatarIcon(index: number): string {
  return AVATAR_ICONS[index % AVATAR_ICONS.length];
}

export function resolveUniquePlayerName(
  desiredName: string,
  existingPlayers: Record<string, Player>,
  currentPlayerId: string
): string {
  const baseName = desiredName.trim().slice(0, 12) || 'Player';
  const otherNames = new Set(
    Object.values(existingPlayers)
      .filter((p) => p.id !== currentPlayerId)
      .map((p) => p.name.toLowerCase())
  );

  if (!otherNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let counter = 2;
  while (counter < 99) {
    const suffix = ` ${counter}`;
    const truncatedBase = baseName.slice(0, 12 - suffix.length).trim();
    const candidate = `${truncatedBase}${suffix}`;
    if (!otherNames.has(candidate.toLowerCase())) {
      return candidate;
    }
    counter++;
  }
  return `${baseName.slice(0, 9)} ${Math.floor(Math.random() * 90 + 10)}`;
}

export function generateRandomGrid(): number[] {
  const nums = Array.from({ length: 25 }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

export function generateSeededGrid(seedStr: string): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const nextRand = () => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const nums = Array.from({ length: 25 }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

export function autoFillPartialGrid(currentGrid: (number | null)[]): number[] {
  const used = new Set(
    currentGrid.filter((n): n is number => n !== null && n >= 1 && n <= 25)
  );
  const missing: number[] = [];
  for (let n = 1; n <= 25; n++) {
    if (!used.has(n)) {
      missing.push(n);
    }
  }
  for (let i = missing.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [missing[i], missing[j]] = [missing[j], missing[i]];
  }

  let missingIdx = 0;
  return currentGrid.map((cell) => {
    if (cell !== null && cell >= 1 && cell <= 25) {
      return cell;
    }
    return missing[missingIdx++];
  });
}

export function evaluateGridLines(
  grid: (number | null)[],
  calledNumbers: number[]
): {
  completedLines: CompletedLine[];
  completedCellIndices: Set<number>;
  linesCount: number;
} {
  const calledSet = new Set(calledNumbers);
  const completedLines: CompletedLine[] = [];
  const completedCellIndices = new Set<number>();

  if (grid.length !== 25) {
    return { completedLines, completedCellIndices, linesCount: 0 };
  }

  const isCellMarked = (idx: number) => {
    const val = grid[idx];
    return val !== null && calledSet.has(val);
  };

  // 1. Check 5 rows
  for (let r = 0; r < 5; r++) {
    const cells = [r * 5, r * 5 + 1, r * 5 + 2, r * 5 + 3, r * 5 + 4];
    if (cells.every(isCellMarked)) {
      completedLines.push({ type: 'row', index: r, cells });
      cells.forEach((c) => completedCellIndices.add(c));
    }
  }

  // 2. Check 5 columns
  for (let c = 0; c < 5; c++) {
    const cells = [c, c + 5, c + 10, c + 15, c + 20];
    if (cells.every(isCellMarked)) {
      completedLines.push({ type: 'col', index: c, cells });
      cells.forEach((c) => completedCellIndices.add(c));
    }
  }

  // 3. Main Diagonal (\)
  const diag1 = [0, 6, 12, 18, 24];
  if (diag1.every(isCellMarked)) {
    completedLines.push({ type: 'diag', index: 0, cells: diag1 });
    diag1.forEach((c) => completedCellIndices.add(c));
  }

  // 4. Anti-Diagonal (/)
  const diag2 = [4, 8, 12, 16, 20];
  if (diag2.every(isCellMarked)) {
    completedLines.push({ type: 'diag', index: 1, cells: diag2 });
    diag2.forEach((c) => completedCellIndices.add(c));
  }

  return {
    completedLines,
    completedCellIndices,
    linesCount: completedLines.length,
  };
}

export function pickRandomUncalledNumber(calledNumbers: number[]): number | null {
  const calledSet = new Set(calledNumbers);
  const available: number[] = [];
  for (let n = 1; n <= 25; n++) {
    if (!calledSet.has(n)) {
      available.push(n);
    }
  }
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

export function pickSmartBotNumber(grid: number[], calledNumbers: number[]): number | null {
  const calledSet = new Set(calledNumbers);
  const available = grid.filter((n) => !calledSet.has(n));
  if (available.length === 0) return null;

  let bestScore = -1;
  let bestCandidates: number[] = [];

  const allLines = [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];

  for (let idx = 0; idx < 25; idx++) {
    const num = grid[idx];
    if (calledSet.has(num)) continue;

    let score = 0;
    for (const line of allLines) {
      if (line.includes(idx)) {
        const markedInLine = line.filter((cellIdx) => calledSet.has(grid[cellIdx])).length;
        score += Math.pow(markedInLine + 1, 2);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidates = [num];
    } else if (score === bestScore) {
      bestCandidates.push(num);
    }
  }

  return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
}

export function computeRankingsAndGameOver(playersMap: Record<string, Player>): {
  updatedRanks: Record<string, number | null>;
  isGameOver: boolean;
  nextActivePlayers: string[];
} {
  const players = Object.values(playersMap);
  const connectedPlayers = players.filter((p) => p.connected);

  const finishers = players
    .filter((p) => p.linesCompleted >= 5 && p.bingoAtCallCount !== null)
    .sort((a, b) => (a.bingoAtCallCount ?? 999) - (b.bingoAtCallCount ?? 999));

  const updatedRanks: Record<string, number | null> = {};
  players.forEach((p) => {
    updatedRanks[p.id] = null;
  });

  let currentRank = 1;
  let i = 0;
  while (i < finishers.length) {
    const callCount = finishers[i].bingoAtCallCount;
    let j = i;
    while (j < finishers.length && finishers[j].bingoAtCallCount === callCount) {
      updatedRanks[finishers[j].id] = currentRank;
      j++;
    }
    currentRank += 1;
    i = j;
  }

  const unfinishedConnected = connectedPlayers.filter((p) => p.linesCompleted < 5);
  const isGameOver = finishers.length > 0 && unfinishedConnected.length <= 1;

  if (isGameOver) {
    unfinishedConnected.forEach((p) => {
      updatedRanks[p.id] = currentRank;
    });
  }

  const nextActivePlayers = unfinishedConnected.map((p) => p.id);

  return {
    updatedRanks,
    isGameOver,
    nextActivePlayers,
  };
}
