// ============================================================
// Configuration
// ============================================================

export const BOARD_SIZE = 9;
export const PIECE_COUNT = 4;
export const FLY_STEPS = 3;
export const RETREAT_STEPS = 2;
export const INNER_SIZE = 5;

// ============================================================
// Derived — outer ring (32) + inner ring (16) = 48 cells
// ============================================================

const OUTER = 4 * BOARD_SIZE - 4;                        // 32
const INNER = 4 * INNER_SIZE - 4;                        // 16
export const RING_LENGTH = OUTER + INNER;                // 48
export const CENTER_INDEX = RING_LENGTH;
export const CENTER_ROW = Math.ceil(BOARD_SIZE / 2);
export const INNER_START = Math.ceil((BOARD_SIZE - INNER_SIZE) / 2) + 1;

// Player config
const ALL_PLAYERS = [
  { id: 0, color: "red" as const, name: "红方", startIndex: 0 },
  { id: 1, color: "blue" as const, name: "蓝方", startIndex: 0 },
  { id: 2, color: "green" as const, name: "绿方", startIndex: 0 },
  { id: 3, color: "yellow" as const, name: "黄方", startIndex: 0 },
];

export function makePlayers(count: number): Player[] {
  const OUTER = 4 * BOARD_SIZE - 4; // 32 — starts on outer ring only
  return ALL_PLAYERS.slice(0, count).map((p, i) => ({
    ...p, startIndex: Math.floor((i * OUTER) / count),
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

export interface Player { id: number; color: PlayerColor; name: string; startIndex: number; }
export interface Piece { player: number; steps: number; }

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
// Grid mapping — dual ring
// ============================================================

export function indexToGrid(i: number): { row: number; col: number } {
  const N = BOARD_SIZE;

  // Outer ring (0..OUTER-1)
  if (i < OUTER) {
    const rightStart = N;
    const bottomStart = 2 * N - 2;
    const leftStart = 3 * N - 2;
    if (i < rightStart) return { row: 1, col: i + 1 };
    if (i < bottomStart) return { row: i - N + 2, col: N };
    if (i < leftStart) return { row: N, col: leftStart - i };
    return { row: 4 * N - 3 - i, col: 1 };
  }

  // Inner ring (OUTER..OUTER+INNER-1)
  let j = i - OUTER;
  const s = INNER_START; // start row/col
  const M = INNER_SIZE;
  if (j < M) return { row: s, col: s + j };
  j -= M;
  if (j < M - 1) return { row: s + 1 + j, col: s + M - 1 };
  j -= (M - 1);
  if (j < M - 1) return { row: s + M - 1, col: s + M - 2 - j };
  j -= (M - 1);
  return { row: s + M - 2 - j, col: s };
}

// ============================================================
// Cell builder
// ============================================================

const PARTY_LABELS: string[] = [
  "干一杯 🍻", "唱一首歌 🎤", "真心话 😈", "大冒险 🎲",
  "指定下家喝一杯", "自罚一杯 🥃", "讲个笑话 😂", "模仿动物叫 🐔",
  "石头剪刀布 ✊", "夸右边的人一句 💕", "说一件糗事 😳",
  "跳段舞 💃", "即兴 rap 🎵", "对视10秒不眨眼 👀",
  "用方言读消息 📱", "闭眼猜人 🤔", "亲一下空气 💋",
  "做5个俯卧撑 💪", "大笑三声 😆", "深情朗诵歌词 📝",
  "比个心 ❤️", "学机器人说话 🤖", "唱两句情歌 🎶",
  "敬全场一杯 🥂", "模仿同桌的表情 😜",
  "和左边的人喝交杯 🍷", "背一首古诗 📜", "单脚站立10秒 🦵",
  "用娃娃音说话 🍼", "和对面猜拳 ✊", "拍一张自拍发群 📸",
  "唱一首儿歌 🎵", "说绕口令 🗣", "做鬼脸拍照 😜",
  "深情看着右边的人 👀", "表演被电击 ⚡", "装死10秒 💀",
  "说三个自己的优点 👍", "给同桌按摩肩膀 💆", "扮演服务员 🍽",
  "说一个秘密 🤫", "用英文介绍自己 🌍", "唱国歌 🎌",
  "学一种乐器声音 🎸", "用最嗲的声音说话 💅", "翻个白眼 🙄",
];

export function buildCells(
  labels: Record<number, string> = {},
  rules?: { flyCells?: number[]; retreatCells?: number[]; safeCells?: number[] },
  playerCount = 2
): Cell[] {
  const players = makePlayers(playerCount as 2 | 4);
  const startSet = new Set(players.map((p) => p.startIndex));

  let flyCells = rules?.flyCells ?? [];
  let retreatCells = rules?.retreatCells ?? [];
  let safeCells = rules?.safeCells ?? [];

  if (flyCells.length === 0 && retreatCells.length === 0 && safeCells.length === 0) {
    const half = Math.floor(RING_LENGTH / 2);
    flyCells = [Math.floor(RING_LENGTH / 8), Math.floor(RING_LENGTH / 8) + half, Math.floor(RING_LENGTH / 4) + half, Math.floor(3 * RING_LENGTH / 4)].filter((i) => i < RING_LENGTH);
    retreatCells = [(flyCells[0] + 2) % RING_LENGTH, (flyCells[1] + 2) % RING_LENGTH];
    safeCells = [(flyCells[0] + RING_LENGTH - 2) % RING_LENGTH, (flyCells[1] + RING_LENGTH - 2) % RING_LENGTH];
  }

  const flySet = new Set(flyCells);
  const retreatSet = new Set(retreatCells);
  const safeSet = new Set(safeCells);
  const cells: Cell[] = [];

  for (let i = 0; i < RING_LENGTH; i++) {
    let type: CellType = "normal";
    let effect: Cell["effect"];
    let player: number | undefined;

    if (startSet.has(i)) { type = "start"; player = players.find((p) => p.startIndex === i)!.id; }
    else if (flySet.has(i)) { type = "fly"; effect = { target: (i + FLY_STEPS) % RING_LENGTH }; }
    else if (retreatSet.has(i)) { type = "retreat"; effect = { steps: RETREAT_STEPS }; }
    else if (safeSet.has(i)) { type = "safe"; }

    let cellLabel = labels[i];
    if (cellLabel === undefined && type === "normal") {
      const normalIdx = Array.from({ length: RING_LENGTH }, (_, j) => j)
        .filter((j) => !startSet.has(j) && !flySet.has(j) && !retreatSet.has(j) && !safeSet.has(j))
        .indexOf(i);
      cellLabel = normalIdx >= 0 ? (PARTY_LABELS[normalIdx % PARTY_LABELS.length] ?? "") : "";
    }

    cells.push({ index: i, ...indexToGrid(i), type, player, effect, label: cellLabel || undefined });
  }

  cells.push({ index: RING_LENGTH, row: CENTER_ROW, col: CENTER_ROW, type: "end" });
  return cells;
}

// ============================================================
// Piece helpers
// ============================================================

export function getPieceCellIndex(piece: Piece, players: Player[]): number {
  if (piece.steps >= RING_LENGTH) return CENTER_INDEX;
  return (players[piece.player].startIndex + piece.steps) % RING_LENGTH;
}

export function getPieceGrid(piece: Piece, players: Player[]): { row: number; col: number } {
  const idx = getPieceCellIndex(piece, players);
  if (idx === CENTER_INDEX) return { row: CENTER_ROW, col: CENTER_ROW };
  return indexToGrid(idx);
}

export function getCellContent(cell: Cell): string | null {
  if (cell.type === "normal" && cell.label) return cell.label;
  if (cell.type === "fly") {
    const dist = cell.effect?.target !== undefined
      ? ((cell.effect.target - cell.index) % RING_LENGTH + RING_LENGTH) % RING_LENGTH
      : FLY_STEPS;
    return `✈ 飞行 +${dist}`;
  }
  if (cell.type === "retreat") return `↩ 后退 ${cell.effect?.steps ?? RETREAT_STEPS} 步`;
  if (cell.type === "safe") return "🛡 安全区";
  return null;
}

// ============================================================
// Dice & init
// ============================================================

export function rollDice(): number { return Math.floor(Math.random() * 6) + 1; }

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
    diceValue: null, isRolling: false, winner: null,
    message: "红方先手 · 点击骰子开始", popupMessage: null,
  };
}

// ============================================================
// Move logic
// ============================================================

export function applyMove(state: GameState, diceValue: number, cells: Cell[], players: Player[]): GameState {
  const playerIdx = state.currentPlayer;
  const other = (playerIdx + 1) % players.length;
  const isSolo = players.length === 1;
  const nextLabel = isSolo ? "继续" : `轮到${players[other].name}`;
  const piece = state.pieces[playerIdx];
  const playerCount = players.length;

  if (piece.steps + diceValue > RING_LENGTH) {
    const bouncedSteps = 2 * RING_LENGTH - piece.steps - diceValue;
    const bouncedIdx = (players[playerIdx].startIndex + bouncedSteps) % RING_LENGTH;
    const newPieces = state.pieces.map((p, i) => i === playerIdx ? { ...p, steps: bouncedSteps } : { ...p });
    for (let o = 0; o < playerCount; o++) {
      if (o === playerIdx) continue;
      if (bouncedIdx === getPieceCellIndex(state.pieces[o], players) && !isSafe(cells[bouncedIdx]))
        newPieces[o] = { ...newPieces[o], steps: 0 };
    }
    return { ...state, pieces: newPieces, diceValue, lastDicePlayer: playerIdx, currentPlayer: other,
      message: `${players[playerIdx].name}: 掷 ${diceValue}，过终点反弹 · ${nextLabel}`, popupMessage: null };
  }

  let newSteps = piece.steps + diceValue;

  if (newSteps === RING_LENGTH) {
    const newPieces = state.pieces.map((p) => p);
    newPieces[playerIdx] = { ...piece, steps: RING_LENGTH };
    const endCount = [...state.endCount]; endCount[playerIdx]++;
    const homeCount = [...state.homeCount];
    let winner = null;
    if (homeCount[playerIdx] > 0) { homeCount[playerIdx]--; newPieces[playerIdx] = { player: playerIdx, steps: 0 }; }
    if (endCount[playerIdx] >= PIECE_COUNT) winner = playerIdx;
    return { ...state, pieces: newPieces, homeCount, endCount, lastDicePlayer: playerIdx, diceValue, winner,
      message: winner ? `🎉 ${players[playerIdx].name}全部抵达，获胜！` : `${players[playerIdx].name}: 第 ${endCount[playerIdx]} 个棋子抵达！ · ${nextLabel}`,
      popupMessage: "🎉 棋子抵达终点" };
  }

  const landedIdx = (players[playerIdx].startIndex + newSteps) % RING_LENGTH;
  const landedCell = cells[landedIdx];
  const popupMessage = getCellContent(landedCell);
  const messages: string[] = [];

  if (landedCell.type === "fly" && landedCell.effect?.target !== undefined) {
    const s = (landedCell.effect.target - players[playerIdx].startIndex + RING_LENGTH) % RING_LENGTH;
    if (s > 0 && s < RING_LENGTH) {
      const flyDist = ((landedCell.effect.target - landedIdx) % RING_LENGTH + RING_LENGTH) % RING_LENGTH;
      newSteps = s;
      messages.push(`✈ 飞行 +${flyDist}`);
    }
  } else if (landedCell.type === "retreat" && landedCell.effect?.steps !== undefined) {
    newSteps = Math.max(0, newSteps - landedCell.effect.steps);
    messages.push(`↩ 后退 ${landedCell.effect.steps} 步`);
  } else if (landedCell.type === "safe") { messages.push("🛡 安全区"); }
  else if (landedCell.label) { messages.push(landedCell.label); }

  const finalIdx = (players[playerIdx].startIndex + newSteps) % RING_LENGTH;
  const newPieces = state.pieces.map((p) => p);
  newPieces[playerIdx] = { ...piece, steps: newSteps };
  for (let o = 0; o < playerCount; o++) {
    if (o === playerIdx) continue;
    if (finalIdx === getPieceCellIndex(state.pieces[o], players) && !isSafe(cells[finalIdx]))
    { newPieces[o] = { ...newPieces[o], steps: 0 }; messages.unshift(`💥 撞飞${players[o].name}`); }
  }

  return { ...state, pieces: newPieces, lastDicePlayer: playerIdx, diceValue, currentPlayer: other,
    message: (messages.length ? `${players[playerIdx].name}: ${messages.join(" · ")} · ` : "") + nextLabel,
    popupMessage };
}

function isSafe(cell: Cell): boolean { return cell.type === "safe" || cell.type === "start"; }
