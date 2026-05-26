"use client";

import {
  BOARD_SIZE, Cell, CENTER_INDEX, GameState,
  getPieceCellIndex, getPieceGrid, Player, RING_LENGTH,
} from "@/lib/board";

interface BoardProps {
  cells: Cell[]; state: GameState; players: Player[];
  onCellClick?: (cell: Cell) => void;
}

const PLAYER_COLORS: Record<number, { bg: string; soft: string }> = {
  0: { bg: "#EF4444", soft: "#FEE2E2" },
  1: { bg: "#3B82F6", soft: "#DBEAFE" },
  2: { bg: "#22C55E", soft: "#DCFCE7" },
  3: { bg: "#EAB308", soft: "#FEF9C3" },
};

function CellInner({ cell }: { cell: Cell }) {
  if (cell.type === "start" && cell.player !== undefined) {
    const c = PLAYER_COLORS[cell.player] || PLAYER_COLORS[0];
    return <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: c.bg }}>
      <span className="text-white text-xs font-bold">★</span></div>;
  }
  if (cell.type === "end") {
    return <div className="absolute inset-0 flex items-center justify-center bg-stone-800">
      <span className="text-amber-300 text-lg">★</span></div>;
  }
  if (cell.type === "fly") return <span className="text-cyan-600 text-sm">✈</span>;
  if (cell.type === "retreat") return <span className="text-amber-600 text-sm font-bold">↩</span>;
  if (cell.type === "safe") return <span className="text-rose-500 text-xs">🛡</span>;
  if (cell.type === "normal" && cell.label) {
    const short = cell.label.length > 8 ? cell.label.slice(0, 8) + "…" : cell.label;
    return <span className="text-[9px] text-stone-600 leading-tight text-center px-0.5 font-medium">{short}</span>;
  }
  return null;
}

export default function Board({ cells, state, players, onCellClick }: BoardProps) {
  const runwayColors = new Map<number, string>();
  players.forEach((p) => {
    runwayColors.set((p.startIndex + 1) % RING_LENGTH, PLAYER_COLORS[p.id].soft);
  });

  const overlap = new Set<number>();
  const seen = new Map<number, number>();
  state.pieces.forEach((piece, i) => {
    const idx = getPieceCellIndex(piece, players);
    if (seen.has(idx)) { overlap.add(seen.get(idx)!); overlap.add(i); }
    else seen.set(idx, i);
  });

  return (
    <div className="grid bg-stone-50 p-3 rounded-2xl border border-stone-300 shadow-lg"
      style={{
        gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        aspectRatio: "1 / 1", width: "100%",
      }}>
      {cells.map((cell) => {
        const bg = runwayColors.get(cell.index) || (cell.type === "start" ? undefined : "white");
        const clickable = cell.type === "normal";
        const isCenter = cell.index === CENTER_INDEX;
        return (
          <div key={cell.index}
            style={{ gridRow: cell.row, gridColumn: cell.col, backgroundColor: isCenter ? undefined : bg }}
            className={`relative border border-stone-300 flex items-center justify-center ${clickable ? "cursor-pointer hover:bg-stone-100" : ""} ${isCenter ? "rounded-full" : ""}`}
            onClick={() => clickable && onCellClick?.(cell)}>
            <CellInner cell={cell} />
          </div>
        );
      })}

      {state.pieces.map((piece, i) => {
        const { row, col } = getPieceGrid(piece, players);
        const c = PLAYER_COLORS[piece.player] || PLAYER_COLORS[0];
        const isCurrent = state.currentPlayer === piece.player && !state.winner;
        const isOverlap = overlap.has(i);
        return (
          <div key={`p-${i}`} style={{ gridRow: row, gridColumn: col }}
            className={`relative pointer-events-none z-10 flex items-center justify-center ${isOverlap ? (i % 2 === 0 ? "justify-start items-start p-0.5" : "justify-end items-end p-0.5") : ""}`}>
            <div className={`${isOverlap ? "w-[45%] h-[45%]" : "w-[55%] h-[55%]"} rounded-full transition-all duration-300 ${isCurrent ? "scale-110 animate-pulse" : ""}`}
              style={{
                background: `radial-gradient(circle at 30% 30%, white, ${c.bg} 65%)`,
                border: `2px solid ${c.bg}`, boxShadow: isCurrent ? `0 0 0 3px ${c.bg}40, 0 4px 12px rgba(0,0,0,0.18)` : "0 2px 6px rgba(0,0,0,0.18)",
              }} />
          </div>
        );
      })}
    </div>
  );
}
