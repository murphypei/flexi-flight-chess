// ============================================================
// Configuration
// ============================================================

export const BOARD_SIZE = 9;
export const PIECE_COUNT = 4;
export const FLY_STEPS = 3;
export const RETREAT_STEPS = 2;

// ============================================================
// Derived constants
// ============================================================

export const RING_LENGTH = 4 * BOARD_SIZE - 4;
export const CENTER_INDEX = RING_LENGTH;
export const CENTER_ROW = Math.ceil(BOARD_SIZE / 2);
export const SECTION_SIZE = BOARD_SIZE - 2;

// Player config for 2/4 players — starts evenly spaced around the ring
const ALL_PLAYERS = [
  { id: 0, color: "red" as const, name: "红方", startIndex: 0 },
  { id: 1, color: "blue" as const, name: "蓝方", startIndex: 0 },
  { id: 2, color: "green" as const, name: "绿方", startIndex: 0 },
  { id: 3, color: "yellow" as const, name: "黄方", startIndex: 0 },
];

export function makePlayers(count: 2 | 4): Player[] {
  return ALL_PLAYERS.slice(0, count).map((p, i) => ({
    ...p,
    startIndex: Math.floor((i * RING_LENGTH) / count),
  }));
}

// ============================================================
// Types
// ============================================================

export type CellType = "normal" | "start" | "safe" | "fly" | "retreat" | "end";
export type PlayerColor = "red" | "blue" | "green" | "yellow";

export interface Cell {
  index: number;
  row: number;
  col: number;
  type: CellType;
  player?: number;
  label?: string;
  effect?: { target?: number; steps?: number };
}

export interface Player {
  id: number;
  color: PlayerColor;
  name: string;
  startIndex: number;
}

export interface Piece {
  player: number;
  steps: number;
}

export interface GameState {
  pieces: Piece[];
  homeCount: number[];
  endCount: number[];
  currentPlayer: number;
  lastDicePlayer: number;
  diceValue: number | null;
  isRolling: boolean;
  winner: number | null;
  message: string;
  popupMessage: string | null;
}

// ============================================================
// Grid mapping
// ============================================================

export function indexToGrid(i: number): { row: number; col: number } {
  const N = BOARD_SIZE;
  const rightStart = N;
  const bottomStart = 2 * N - 2;
  const leftStart = 3 * N - 2;
  if (i < rightStart) return { row: 1, col: i + 1 };
  if (i < bottomStart) return { row: i - N + 2, col: N };
  if (i < leftStart) return { row: N, col: leftStart - i };
  return { row: 4 * N - 3 - i, col: 1 };
}

// ============================================================
// Functional cell placement
// ============================================================

// KTV / party theme labels — one per normal cell
const PARTY_LABELS: string[] = [
  "干一杯 🍻", "唱一首歌 🎤", "真心话 😈", "大冒险 🎲",
  "指定下家喝一杯", "自罚一杯 🥃", "讲个笑话 😂", "模仿动物叫 🐔",
  "石头剪刀布 ✊", "夸右边的人一句 💕", "说一件糗事 😳",
  "跳段舞 💃", "即兴 rap 🎵", "对视 10 秒不眨眼 👀",
  "用方言读消息 📱", "闭眼猜人 🤔", "亲一下空气 💋",
  "做 5 个俯卧撑 💪", "哈哈大笑三声 😆", "深情朗诵歌词 📝",
  "比个心 ❤️", "学机器人说话 🤖", "唱两句情歌 🎶",
  "敬全场一杯 🥂", "模仿同桌的表情 😜",
];

export function buildCells(
  labels: Record<number, string> = {},
  rules?: { flyCells?: number[]; retreatCells?: number[]; safeCells?: number[] },
  playerCount = 2
): Cell[] {
  const players = makePlayers(playerCount as 2 | 4);
  const startSet = new Set(players.map((p) => p.startIndex));

  const flyCells = rules?.flyCells ?? [];
  const retreatCells = rules?.retreatCells ?? [];
  const safeCells = rules?.safeCells ?? [];

  // Default: 2 fly, 2 retreat, 2 safe — placed in opposing sections only
  if (flyCells.length === 0 && retreatCells.length === 0 && safeCells.length === 0) {
    const sectionStart = [0, Math.floor(RING_LENGTH / 2)];
    for (const s of sectionStart) {
      flyCells.push(s + 4 > 0 ? s + 4 : s + 4);
      retreatCells.push(s + 6 > 0 ? s + 6 : s + 6);
      safeCells.push(s + 2);
    }
  }

  const flySet = new Set(flyCells);
  const retreatSet = new Set(retreatCells);
  const safeSet = new Set(safeCells);

  const cells: Cell[] = [];
  for (let i = 0; i < RING_LENGTH; i++) {
    let type: CellType = "normal";
    let effect: Cell["effect"];
    let player: number | undefined;

    if (startSet.has(i)) {
      type = "start";
      player = players.find((p) => p.startIndex === i)!.id;
    } else if (flySet.has(i)) {
      type = "fly";
      effect = { target: (i + FLY_STEPS) % RING_LENGTH };
    } else if (retreatSet.has(i)) {
      type = "retreat";
      effect = { steps: RETREAT_STEPS };
    } else if (safeSet.has(i)) {
      type = "safe";
    }

    // Assign party label to normal cells without a custom label
    let cellLabel = labels[i];
    if (cellLabel === undefined && type === "normal") {
      const normalIdx = Array.from({ length: RING_LENGTH }, (_, j) => j)
        .filter((j) => !startSet.has(j) && !flySet.has(j) && !retreatSet.has(j) && !safeSet.has(j))
        .indexOf(i);
      cellLabel = normalIdx >= 0 ? (PARTY_LABELS[normalIdx % PARTY_LABELS.length] ?? "") : "";
    }

    cells.push({
      index: i, ...indexToGrid(i), type, player, effect, label: cellLabel || undefined,
    });
  }

  cells.push({ index: CENTER_INDEX, row: CENTER_ROW, col: CENTER_ROW, type: "end" });
  return cells;
}

// ============================================================
// Piece helpers
// ============================================================

export function getPieceCellIndex(piece: Piece, players: Player[]): number {
  if (piece.steps >= RING_LENGTH) return CENTER_INDEX;
  const p = players[piece.player];
  return (p.startIndex + piece.steps) % RING_LENGTH;
}

export function getPieceGrid(piece: Piece, players: Player[]): { row: number; col: number } {
  const idx = getPieceCellIndex(piece, players);
  if (idx === CENTER_INDEX) return { row: CENTER_ROW, col: CENTER_ROW };
  return indexToGrid(idx);
}

export function getCellContent(cell: Cell): string | null {
  if (cell.type === "normal" && cell.label) return cell.label;
  if (cell.type === "fly") return `✈ 飞行 +${FLY_STEPS}`;
  if (cell.type === "retreat") return `↩ 后退 ${RETREAT_STEPS}`;
  if (cell.type === "safe") return "🛡 安全区";
  return null;
}

// ============================================================
// Dice & init
// ============================================================

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function initGameState(playerCount: number): GameState {
  const pieces: Piece[] = [];
  const homeCount: number[] = [];
  const endCount: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    pieces.push({ player: i, steps: 0 });
    homeCount.push(PIECE_COUNT - 1);
    endCount.push(0);
  }
  return {
    pieces, homeCount, endCount,
    currentPlayer: 0, lastDicePlayer: 0,
    diceValue: null, isRolling: false,
    winner: null,
    message: "红方先手 · 点击骰子开始",
    popupMessage: null,
  };
}

// ============================================================
// Move logic
// ============================================================

export function applyMove(state: GameState, diceValue: number, cells: Cell[], players: Player[]): GameState {
  const playerIdx = state.currentPlayer;
  const other = (playerIdx + 1) % players.length;
  const piece = state.pieces[playerIdx];
  const playerCount = players.length;

  // Overshoot → bounce
  if (piece.steps + diceValue > RING_LENGTH) {
    const bouncedSteps = 2 * RING_LENGTH - piece.steps - diceValue;
    const bouncedIdx = (players[playerIdx].startIndex + bouncedSteps) % RING_LENGTH;
    const newPieces = state.pieces.map((p, i) => i === playerIdx ? { ...p, steps: bouncedSteps } : { ...p });

    // Check bump for all other players
    for (let o = 0; o < playerCount; o++) {
      if (o === playerIdx) continue;
      const oIdx = getPieceCellIndex(state.pieces[o], players);
      if (bouncedIdx === oIdx && !isSafe(cells[bouncedIdx])) {
        newPieces[o] = { ...newPieces[o], steps: 0 };
      }
    }

    return {
      ...state, pieces: newPieces, diceValue,
      lastDicePlayer: playerIdx, currentPlayer: other,
      message: `${players[playerIdx].name}: 掷 ${diceValue}，过终点反弹 · 轮到${players[other].name}`,
      popupMessage: null,
    };
  }

  let newSteps = piece.steps + diceValue;

  // Reach center
  if (newSteps === RING_LENGTH) {
    const newPieces = state.pieces.map((p) => p);
    newPieces[playerIdx] = { ...piece, steps: RING_LENGTH };
    const endCount = [...state.endCount];
    endCount[playerIdx]++;
    const homeCount = [...state.homeCount];
    let winner: number | null = null;

    if (homeCount[playerIdx] > 0) {
      homeCount[playerIdx]--;
      newPieces[playerIdx] = { player: playerIdx, steps: 0 };
    }
    if (endCount[playerIdx] >= PIECE_COUNT) winner = playerIdx;

    return {
      ...state, pieces: newPieces, homeCount, endCount,
      lastDicePlayer: playerIdx, diceValue, winner,
      message: winner !== null
        ? `🎉 ${players[playerIdx].name}全部抵达，获胜！`
        : `${players[playerIdx].name}: 第 ${endCount[playerIdx]} 个棋子抵达！ · 轮到${players[other].name}`,
      popupMessage: "🎉 棋子抵达终点",
    };
  }

  // Landed cell
  const landedIdx = (players[playerIdx].startIndex + newSteps) % RING_LENGTH;
  const landedCell = cells[landedIdx];
  const popupMessage = getCellContent(landedCell);
  const messages: string[] = [];

  if (landedCell.type === "fly" && landedCell.effect?.target !== undefined) {
    const s = (landedCell.effect.target - players[playerIdx].startIndex + RING_LENGTH) % RING_LENGTH;
    if (s > 0 && s < RING_LENGTH) { newSteps = s; messages.push(`✈ 飞行 +${FLY_STEPS}`); }
  } else if (landedCell.type === "retreat" && landedCell.effect?.steps !== undefined) {
    newSteps = Math.max(0, newSteps - landedCell.effect.steps);
    messages.push(`↩ 后退 ${landedCell.effect.steps} 步`);
  } else if (landedCell.type === "safe") {
    messages.push("🛡 安全区");
  } else if (landedCell.label) {
    messages.push(landedCell.label);
  }

  // Collision (check all other players)
  const finalIdx = (players[playerIdx].startIndex + newSteps) % RING_LENGTH;
  const newPieces = state.pieces.map((p) => p);
  newPieces[playerIdx] = { ...piece, steps: newSteps };

  for (let o = 0; o < playerCount; o++) {
    if (o === playerIdx) continue;
    const oIdx = getPieceCellIndex(state.pieces[o], players);
    if (finalIdx === oIdx && !isSafe(cells[finalIdx])) {
      newPieces[o] = { ...newPieces[o], steps: 0 };
      messages.unshift(`💥 撞飞${players[o].name}`);
    }
  }

  return {
    ...state, pieces: newPieces,
    lastDicePlayer: playerIdx, diceValue, currentPlayer: other,
    message:
      (messages.length ? `${players[playerIdx].name}: ${messages.join(" · ")} · ` : "") +
      `轮到${players[other].name}`,
    popupMessage,
  };
}

function isSafe(cell: Cell): boolean {
  return cell.type === "safe" || cell.type === "start";
}

// ============================================================
// LocalStorage
// ============================================================

const LABELS_KEY = "ffc_cell_labels_v2";

export function loadLabels(): Record<number, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LABELS_KEY);
    return raw ? (JSON.parse(raw) as Record<number, string>) : {};
  } catch { return {}; }
}

export function saveLabels(labels: Record<number, string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
}
