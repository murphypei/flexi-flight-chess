"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BOARD_SIZE, Cell, CellType, CENTER_INDEX, indexToGrid, makePlayers, RING_LENGTH,
} from "@/lib/board";
import { createBoard, getBoard, updateBoard } from "@/lib/db";

const CELL_COLORS: Record<CellType, string> = {
  normal: "bg-white border-stone-300",
  start: "border-stone-700",
  safe: "bg-rose-100 border-rose-400",
  fly: "bg-cyan-100 border-cyan-400",
  retreat: "bg-amber-100 border-amber-400",
  end: "bg-amber-200 border-amber-500",
};

const TYPES: { value: CellType; label: string; icon: string }[] = [
  { value: "normal", label: "普通", icon: "📝" },
  { value: "fly", label: "飞行 +3", icon: "✈" },
  { value: "retreat", label: "后退 -2", icon: "↩" },
  { value: "safe", label: "安全", icon: "🛡" },
];

export default function BoardEditPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [step, setStep] = useState<"password" | "players" | "edit">("password");
  const [cells, setCells] = useState<Cell[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState<CellType>("normal");
  const [boardName, setBoardName] = useState("");
  const [saving, setSaving] = useState(false);

  const startIndices = useMemo(() => {
    const players = makePlayers(playerCount);
    return new Set(players.map((p) => p.startIndex));
  }, [playerCount]);

  // Initialize empty cells
  useEffect(() => {
    if (!authed || step !== "edit") return;
    const newCells: Cell[] = [];
    for (let i = 0; i < RING_LENGTH; i++) {
      const isStart = startIndices.has(i);
      newCells.push({
        index: i, ...indexToGrid(i),
        type: isStart ? "start" : "normal",
        player: isStart ? (i === 0 ? 0 : i === Math.floor(RING_LENGTH / 2) ? 1 : i === Math.floor(RING_LENGTH / 4) ? 2 : 3) : undefined,
        label: "",
      });
    }
    newCells.push({ index: CENTER_INDEX, row: Math.ceil(BOARD_SIZE / 2), col: Math.ceil(BOARD_SIZE / 2), type: "end" });
    setCells(newCells);
  }, [authed, step, playerCount, startIndices]);

  function handleAuth() {
    const pwd = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
    if (password === pwd) {
      setAuthed(true);
      setStep("players");
    } else {
      alert("密码错误");
    }
  }

  function handlePlayerSelect(count: 2 | 4) {
    setPlayerCount(count);
    setStep("edit");
  }

  function handleCellClick(cell: Cell) {
    if (cell.type === "start" || cell.type === "end") return;
    setSelectedIdx(cell.index);
    setEditText(cell.label || "");
    setEditType(cell.type);
  }

  function handleApplyEdit() {
    if (selectedIdx === null) return;
    const newCells = cells.map((c) => {
      if (c.index !== selectedIdx) return c;
      if (editType === "normal") return { ...c, type: "normal" as CellType, label: editText, effect: undefined };
      if (editType === "fly") return { ...c, type: "fly" as CellType, label: "", effect: { target: (c.index + 3) % RING_LENGTH } };
      if (editType === "retreat") return { ...c, type: "retreat" as CellType, label: "", effect: { steps: 2 } };
      if (editType === "safe") return { ...c, type: "safe" as CellType, label: "", effect: undefined };
      return c;
    });
    setCells(newCells);
    setSelectedIdx(null);
  }

  async function handleSave() {
    if (!boardName.trim()) { alert("请输入棋盘名称"); return; }
    setSaving(true);
    try {
      const result = await createBoard({
        name: boardName.trim(),
        description: `${BOARD_SIZE}×${BOARD_SIZE} 回字形，${playerCount}人自定义`,
        player_count: playerCount,
        board_size: BOARD_SIZE,
        cells,
        rules: {},
        is_template: false,
      });
      alert("保存成功！");
      router.push(`/board/new?id=${result.id}`);
    } catch (e: any) {
      alert("保存失败: " + (e.message || ""));
    }
    setSaving(false);
  }

  if (!authed || step === "password") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
        <div className="bg-white rounded-2xl p-6 shadow-lg max-w-sm w-full">
          <h1 className="text-xl font-bold mb-4">管理员验证</h1>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="输入管理密码" className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-stone-700 focus:outline-none text-sm mb-3" onKeyDown={(e) => e.key === "Enter" && handleAuth()} />
          <button onClick={handleAuth} className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold">确认</button>
          <button onClick={() => router.push("/board/new")} className="w-full text-sm text-stone-500 mt-3">← 返回</button>
        </div>
      </main>
    );
  }

  if (step === "players") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
        <div className="bg-white rounded-2xl p-6 shadow-lg max-w-sm w-full">
          <h1 className="text-xl font-bold mb-4">选择人数</h1>
          <div className="space-y-3">
            <button onClick={() => handlePlayerSelect(2)} className="w-full p-4 rounded-xl border-2 border-stone-200 hover:border-stone-400 text-left bg-white">
              <div className="font-semibold">2 人对战</div>
              <div className="text-xs text-stone-500 mt-1">两个起点，对角分布</div>
            </button>
            <button onClick={() => handlePlayerSelect(4)} className="w-full p-4 rounded-xl border-2 border-stone-200 hover:border-stone-400 text-left bg-white">
              <div className="font-semibold">4 人对战</div>
              <div className="text-xs text-stone-500 mt-1">四个起点，四角分布</div>
            </button>
          </div>
          <button onClick={() => router.push("/board/new")} className="w-full text-sm text-stone-500 mt-3">← 返回</button>
        </div>
      </main>
    );
  }

  const selectedCell = selectedIdx !== null ? cells.find((c) => c.index === selectedIdx) : null;

  return (
    <main className="min-h-screen" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
      <div className="max-w-[500px] mx-auto px-4 py-4">
        {/* Header */}
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">自定义棋盘</h1>
          <span className="text-xs text-stone-500 bg-white px-2 py-1 rounded-full">{playerCount}人</span>
        </header>

        {/* Board name */}
        <div className="mb-4">
          <input value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="棋盘名称（如：我的专属棋盘）" className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-stone-700 focus:outline-none text-sm bg-white" maxLength={20} />
        </div>

        {/* Board preview */}
        <div className="bg-stone-50 p-3 rounded-2xl border border-stone-300 shadow-lg mb-4">
          <div
            className="grid gap-[2px]"
            style={{
              gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
              gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
              aspectRatio: "1 / 1",
            }}
          >
            {cells.map((cell) => {
              if (cell.type === "end") return <div key={cell.index} style={{ gridRow: cell.row, gridColumn: cell.col }} />;
              const isStart = cell.type === "start";
              const isSelected = cell.index === selectedIdx;
              const color = isStart && cell.player !== undefined
                ? ["#EF4444", "#3B82F6", "#22C55E", "#EAB308"][cell.player]
                : undefined;

              return (
                <div
                  key={cell.index}
                  style={{ gridRow: cell.row, gridColumn: cell.col, backgroundColor: isStart ? color : undefined }}
                  className={`relative border border-stone-300 flex items-center justify-center rounded-sm text-[8px] leading-tight text-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all ${isSelected ? "ring-2 ring-blue-500 z-10" : ""} ${isStart ? "cursor-default hover:ring-0" : ""}`}
                  onClick={() => handleCellClick(cell)}
                >
                  {isStart ? (
                    <span className="text-white text-xs font-bold">★</span>
                  ) : cell.type === "fly" ? (
                    <span className="text-cyan-600 text-sm">✈</span>
                  ) : cell.type === "retreat" ? (
                    <span className="text-amber-600 text-sm">↩</span>
                  ) : cell.type === "safe" ? (
                    <span className="text-rose-500 text-xs">🛡</span>
                  ) : cell.label ? (
                    <span className="text-stone-600 px-0.5">{cell.label}</span>
                  ) : (
                    <span className="text-stone-300">+</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit panel */}
        {selectedCell && (
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-stone-200 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">编辑格子 #{selectedCell.index}</h3>
              <button onClick={() => setSelectedIdx(null)} className="text-stone-400 hover:text-stone-700">✕</button>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setEditType(t.value)}
                  className={`py-2 rounded-lg text-xs font-medium border transition-colors ${editType === t.value ? "border-stone-700 bg-stone-100" : "border-stone-200 hover:border-stone-400"}`}
                >
                  <div className="text-lg">{t.icon}</div>
                  <div className="mt-0.5">{t.label}</div>
                </button>
              ))}
            </div>

            {/* Text input for normal type */}
            {editType === "normal" && (
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="输入内容，支持 emoji"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:border-stone-700 focus:outline-none text-sm resize-none"
                rows={2}
                maxLength={30}
              />
            )}

            <button onClick={handleApplyEdit} className="w-full mt-3 py-2.5 bg-stone-900 text-white rounded-xl font-semibold text-sm">应用</button>
          </div>
        )}

        {/* Save */}
        <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold disabled:opacity-50">
          {saving ? "保存中..." : "保存棋盘"}
        </button>

        <button onClick={() => router.push("/board/new")} className="w-full text-sm text-stone-500 py-2">← 返回棋盘列表</button>
      </div>
    </main>
  );
}
