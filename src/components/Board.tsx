"use client";

import {
  BOARD_SIZE, Cell, CENTER_INDEX, START_INDEX, HALFWAY_INDEX, GameState,
  getPieceCellIndex, getPieceGrid, Player,
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
  // Structural cells identified by index — backgrounds never change with type
  const isStart = cell.index === START_INDEX;
  const isEnd = cell.index === CENTER_INDEX;
  const isHalfway = cell.index === HALFWAY_INDEX;

  if (isStart) {
    return <div className="absolute inset-0 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[11px] leading-none">🏁</span>
        <span className="text-[8px] font-bold text-stone-700 leading-none">起点</span>
      </div></div>;
  }
  if (isEnd) {
    return <div className="absolute inset-0 flex items-center justify-center bg-stone-800">
      <span className="text-amber-300 text-lg">★</span></div>;
  }

  // Type-based content
  let inner: React.ReactNode = null;
  if (cell.type === "fly") inner = <span className="text-cyan-600 text-sm">{cell.label || "✈"}</span>;
  else if (cell.type === "retreat") inner = <span className="text-amber-600 text-sm font-bold">{cell.label || "↩"}</span>;
  else if (cell.type === "safe") inner = <span className="text-rose-500 text-xs">{cell.label || "🛡"}</span>;
  else if (cell.label) {
    const short = cell.label.length > 5 ? cell.label.slice(0, 5) + "…" : cell.label;
    inner = <span className="text-[9px] text-stone-600 leading-tight text-center px-0.5 font-medium">{short}</span>;
  }

  // Halfway cell: amber background + type content on top
  if (isHalfway) {
    return <div className="absolute inset-0 flex items-center justify-center bg-amber-100">{inner}</div>;
  }
  return inner;
}

export default function Board({ cells, state, players, onCellClick }: BoardProps) {
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
        const bg = cell.type === "start" ? undefined : "white";
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
