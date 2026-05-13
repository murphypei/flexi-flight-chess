"use client";

import {
  BOARD_SIZE,
  Cell,
  CENTER_INDEX,
  CENTER_ROW,
  GameState,
  getPieceCellIndex,
  getPieceGrid,
  makePlayers,
  PIECE_COUNT,
  Player,
  RING_LENGTH,
} from "@/lib/board";

interface BoardProps {
  cells: Cell[];
  state: GameState;
  players: Player[];
  onCellClick?: (cell: Cell) => void;
}

const PLAYER_COLORS: Record<number, { bg: string; soft: string; border: string }> = {
  0: { bg: "#EF4444", soft: "#FEE2E2", border: "#DC2626" },
  1: { bg: "#3B82F6", soft: "#DBEAFE", border: "#2563EB" },
  2: { bg: "#22C55E", soft: "#DCFCE7", border: "#16A34A" },
  3: { bg: "#EAB308", soft: "#FEF9C3", border: "#CA8A04" },
};

function getRunwaySet(playerIndex: number, players: Player[]) {
  const p = players[playerIndex];
  return new Set([(p.startIndex + 1) % RING_LENGTH]);
}

function CellInner({ cell }: { cell: Cell }) {
  if (cell.type === "start" && cell.player !== undefined) {
    const c = PLAYER_COLORS[cell.player] || PLAYER_COLORS[0];
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: c.bg }}>
        <span className="text-white text-base font-bold">★</span>
      </div>
    );
  }
  if (cell.type === "fly") return <span className="text-cyan-600 text-base">✈</span>;
  if (cell.type === "retreat") return <span className="text-amber-600 text-base font-bold">↩</span>;
  if (cell.type === "safe") return <span className="text-rose-500 text-sm">🛡</span>;
  if (cell.type === "normal" && cell.label) {
    return (
      <span className="text-[9px] text-stone-600 leading-tight text-center px-0.5 line-clamp-2 font-medium">
        {cell.label}
      </span>
    );
  }
  return null;
}

function HomeBase({
  color,
  count,
  position,
}: {
  color: { bg: string; soft: string; border: string };
  count: number;
  position: { row: string; col: string };
}) {
  return (
    <div style={{ gridRow: position.row, gridColumn: position.col }} className="relative rounded-xl flex items-center justify-center">
      <div className="absolute inset-1 rounded-lg scale-[0.75]" style={{ backgroundColor: color.soft, border: `2px solid ${color.bg}` }} />
      <div className="relative grid grid-cols-2 gap-1 scale-[0.75]">
        {Array.from({ length: PIECE_COUNT }, (_, i) => i).map((i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-full transition-all duration-300"
            style={{
              background: i < count ? `radial-gradient(circle at 30% 30%, ${color.soft}, ${color.bg} 70%)` : "transparent",
              border: i < count ? `1px solid ${color.border}` : `1px dashed ${color.border}40`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CenterFinish() {
  return (
    <div style={{ gridRow: `${CENTER_ROW - 1} / ${CENTER_ROW + 2}`, gridColumn: `${CENTER_ROW - 1} / ${CENTER_ROW + 2}` }} className="relative flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-[60%] h-[60%]">
        <rect width="100" height="100" fill="white" />
        <polygon points="0,0 100,0 50,50" fill="#EF4444" />
        <polygon points="100,0 100,100 50,50" fill="#3B82F6" />
        <polygon points="100,100 0,100 50,50" fill="#22C55E" />
        <polygon points="0,100 0,0 50,50" fill="#EAB308" />
        <circle cx="50" cy="50" r="14" fill="white" />
        <text x="50" y="58" textAnchor="middle" fontSize="22" fill="#0A0A0A" fontWeight="700">★</text>
      </svg>
    </div>
  );
}

export default function Board({ cells, state, players, onCellClick }: BoardProps) {
  const overlap = new Set<number>();
  const seen = new Map<number, number>();
  state.pieces.forEach((piece, i) => {
    const idx = getPieceCellIndex(piece, players);
    if (seen.has(idx)) { overlap.add(seen.get(idx)!); overlap.add(i); }
    else seen.set(idx, i);
  });

  // Compute runway colors for each player
  const runwayColors = new Map<number, string>();
  players.forEach((_, pIdx) => {
    const set = getRunwaySet(pIdx, players);
    set.forEach((idx) => runwayColors.set(idx, PLAYER_COLORS[pIdx].soft));
  });

  // Home base positions for up to 4 players (inner corners)
  const basePositions = [
    { row: "2 / 4", col: "2 / 4" },
    { row: `${BOARD_SIZE - 2} / ${BOARD_SIZE}`, col: `${BOARD_SIZE - 2} / ${BOARD_SIZE}` },
    { row: "2 / 4", col: `${BOARD_SIZE - 2} / ${BOARD_SIZE}` },
    { row: `${BOARD_SIZE - 2} / ${BOARD_SIZE}`, col: "2 / 4" },
  ];

  return (
    <div
      className="grid bg-stone-50 p-4 rounded-2xl border border-stone-300 shadow-lg"
      style={{
        gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        aspectRatio: "1 / 1",
        width: "100%",
      }}
    >
      {/* Home bases for all players */}
      {players.map((p, i) => (
        <HomeBase key={p.id} color={PLAYER_COLORS[p.id]} count={state.homeCount[p.id]} position={basePositions[i % 4]} />
      ))}

      <CenterFinish />

      {/* Path cells */}
      {cells.map((cell) => {
        if (cell.index === CENTER_INDEX) return null;
        const bg = runwayColors.get(cell.index) || (cell.type === "start" ? undefined : "white");
        const clickable = cell.type === "normal";

        return (
          <div
            key={cell.index}
            style={{ gridRow: cell.row, gridColumn: cell.col, backgroundColor: bg }}
            className={`relative border border-stone-300 flex items-center justify-center ${clickable ? "cursor-pointer hover:bg-stone-100 transition-colors" : ""}`}
            onClick={() => clickable && onCellClick?.(cell)}
          >
            <CellInner cell={cell} />
          </div>
        );
      })}

      {/* Pieces */}
      {state.pieces.map((piece, i) => {
        const { row, col } = getPieceGrid(piece, players);
        const c = PLAYER_COLORS[piece.player] || PLAYER_COLORS[0];
        const isCurrent = state.currentPlayer === piece.player && !state.winner;
        const isOverlap = overlap.has(i);

        return (
          <div
            key={`piece-${i}`}
            style={{ gridRow: row, gridColumn: col }}
            className={`relative pointer-events-none z-10 flex items-center justify-center ${isOverlap ? (i % 2 === 0 ? "justify-start items-start p-0.5" : "justify-end items-end p-0.5") : ""}`}
          >
            <div
              className={`${isOverlap ? "w-[45%] h-[45%]" : "w-[55%] h-[55%]"} rounded-full transition-all duration-300 ${isCurrent ? "scale-110 animate-pulse" : ""}`}
              style={{
                background: `radial-gradient(circle at 30% 30%, white, ${c.bg} 65%)`,
                border: `2px solid ${c.border}`,
                boxShadow: isCurrent ? `0 0 0 3px ${c.bg}40, 0 4px 12px rgba(0,0,0,0.18)` : "0 2px 6px rgba(0,0,0,0.18)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
