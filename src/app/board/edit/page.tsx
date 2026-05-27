"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BOARD_SIZE, Cell, CellType, CENTER_INDEX, indexToGrid, makePlayers, RING_LENGTH,
} from "@/lib/board";
import { createBoard, getBoard, updateBoard } from "@/lib/db";
import { FLY_STEPS, RETREAT_STEPS } from "@/lib/board";
import { getSession, User } from "@/lib/auth";

const TYPES: { value: CellType; label: string; icon: string }[] = [
  { value: "normal", label: "普通", icon: "📝" },
  { value: "fly", label: "飞行 +3", icon: "✈" },
  { value: "retreat", label: "后退 -2", icon: "↩" },
  { value: "safe", label: "安全", icon: "🛡" },
];

export default function BoardEditPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userChecked, setUserChecked] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [step, setStep] = useState<"players" | "edit">("players");
  const [cells, setCells] = useState<Cell[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState<CellType>("normal");
  const [boardName, setBoardName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [flySteps, setFlySteps] = useState(FLY_STEPS);
  const [retreatSteps, setRetreatSteps] = useState(RETREAT_STEPS);
  const [isPublic, setIsPublic] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [rulesDesc, setRulesDesc] = useState("");
  const [loadError, setLoadError] = useState("");

  // Read URL params & session on client mount — useState initializers can't use window (SSR)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      setEditId(id);
      setStep("edit");
    }
    setUser(getSession());
    setUserChecked(true);
    setInitDone(true);
  }, []);

  const startIndices = useMemo(() => {
    const players = makePlayers(playerCount);
    return new Set(players.map((p) => p.startIndex));
  }, [playerCount]);

  // Load existing board if editId is set
  useEffect(() => {
    if (!editId) return;
    const u = getSession();
    if (!u) return;
    getBoard(editId).then((b) => {
      if (!b) { setLoadError("棋盘不存在"); return; }
      if (b.owner_id !== u.id) { setLoadError("无权编辑此棋盘"); return; }
      setBoardName(b.name);
      setPlayerCount(b.player_count as 2 | 4);
      setCells(b.cells);
      if (b.rules?.flySteps) setFlySteps(b.rules.flySteps);
      if (b.rules?.retreatSteps) setRetreatSteps(b.rules.retreatSteps);
      if (b.rules?.description) setRulesDesc(b.rules.description);
      setIsPublic(b.is_public);
    });
  }, [editId]);

  // Initialize empty cells for new board — only after initDone confirms no ?id=
  useEffect(() => {
    if (!initDone || editId) return;
    if (step !== "edit") return;
    const newCells: Cell[] = [];
    for (let i = 0; i < RING_LENGTH; i++) {
      newCells.push({
        index: i, ...indexToGrid(i),
        type: i === 0 ? "start" : "normal",
        label: "",
      });
    }
    newCells.push({ index: CENTER_INDEX, row: Math.ceil(BOARD_SIZE / 2), col: Math.ceil(BOARD_SIZE / 2), type: "end" });
    setCells(newCells);
  }, [initDone, step, playerCount, editId]);

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
      if (editType === "fly") return { ...c, type: "fly" as CellType, effect: { target: (c.index + flySteps) % RING_LENGTH } };
      if (editType === "retreat") return { ...c, type: "retreat" as CellType, effect: { steps: retreatSteps } };
      if (editType === "safe") return { ...c, type: "safe" as CellType, effect: undefined };
      return c;
    });
    setCells(newCells);
    setSelectedIdx(null);
  }

  async function handleSave() {
    if (!user) { alert("请先登录"); return; }
    if (!boardName.trim()) { alert("请输入棋盘名称"); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateBoard(editId, {
          name: boardName.trim(), player_count: playerCount, is_public: isPublic,
          cells, rules: { flySteps, retreatSteps, description: rulesDesc },
        });
        alert("已更新！");
      } else {
        await createBoard({
          name: boardName.trim(),
          description: `${BOARD_SIZE}×${BOARD_SIZE} 回字形，${playerCount}人自定义`,
          player_count: playerCount, board_size: BOARD_SIZE,
          cells, rules: { flySteps, retreatSteps, description: rulesDesc },
          is_template: false, is_public: isPublic, owner_id: user.id,
        });
        alert("保存成功！");
      }
      router.push("/board/new");
    } catch (e: any) {
      alert("保存失败: " + (e.message || ""));
    }
    setSaving(false);
  }

  async function handleSaveAs() {
    if (!user) { alert("请先登录"); return; }
    if (!boardName.trim()) { alert("请输入棋盘名称"); return; }
    const newName = prompt("新棋盘名称：", boardName + " (副本)");
    if (!newName) return;
    setSaving(true);
    try {
      await createBoard({
        name: newName.trim(),
        description: `${BOARD_SIZE}×${BOARD_SIZE} 回字形，${playerCount}人自定义`,
        player_count: playerCount, board_size: BOARD_SIZE,
        cells, rules: { flySteps, retreatSteps, description: rulesDesc },
        is_template: false, is_public: isPublic, owner_id: user.id,
      });
      alert("副本已保存！");
      router.push("/board/new");
    } catch (e: any) {
      alert("保存失败: " + (e.message || ""));
    }
    setSaving(false);
  }

  // Not checked yet — prevent hydration flash
  if (!userChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
        <div className="w-6 h-6 border-2 border-stone-700 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
        <div className="bg-white rounded-2xl p-6 shadow-lg max-w-sm w-full text-center">
          <h1 className="text-xl font-bold mb-2">请先登录</h1>
          <p className="text-sm text-stone-500 mb-4">登录后可创建和编辑自定义棋盘</p>
          <button onClick={() => router.push("/login")} className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold text-sm">登录 / 注册</button>
          <button onClick={() => router.push("/board/new")} className="w-full text-sm text-stone-500 mt-3">← 返回棋盘列表</button>
        </div>
      </main>
    );
  }

  // Load error (board not found or not owned)
  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
        <div className="bg-white rounded-2xl p-6 shadow-lg max-w-sm w-full text-center">
          <p className="text-red-500 mb-4">{loadError}</p>
          <button onClick={() => router.push("/board/new")} className="px-4 py-2 bg-stone-900 text-white rounded-lg">← 返回棋盘列表</button>
        </div>
      </main>
    );
  }

  // Still initializing — wait for URL param detection after mount
  if (!initDone) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
        <div className="w-6 h-6 border-2 border-stone-700 border-t-transparent rounded-full animate-spin" />
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

  // Editing an existing board — wait for data to load
  if (editId && cells.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
        <div className="w-6 h-6 border-2 border-stone-700 border-t-transparent rounded-full animate-spin" />
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
        <div className="mb-3">
          <input value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="棋盘名称（如：我的专属棋盘）" className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-stone-700 focus:outline-none text-sm bg-white" maxLength={20} />
        </div>

        {/* Public toggle */}
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-4 h-4 rounded border-stone-300" />
          <span className="text-sm text-stone-600">公开棋盘（其他人可见）</span>
        </label>

        {/* Rules toggle */}
        <button onClick={() => setShowRules(!showRules)} className="w-full text-sm text-stone-500 hover:text-stone-700 mb-3">
          {showRules ? "▲ 收起规则设置" : "▼ 规则设置"}
        </button>
        {showRules && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 mb-3 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-stone-700 w-20">飞行步数</label>
              <input type="number" value={flySteps} onChange={(e) => setFlySteps(Number(e.target.value))} min={1} max={10}
                className="w-20 px-3 py-2 rounded-lg border border-stone-300 text-sm text-center" />
              <span className="text-xs text-stone-400">落地后额外前进</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-stone-700 w-20">后退步数</label>
              <input type="number" value={retreatSteps} onChange={(e) => setRetreatSteps(Number(e.target.value))} min={1} max={10}
                className="w-20 px-3 py-2 rounded-lg border border-stone-300 text-sm text-center" />
              <span className="text-xs text-stone-400">落地后回退</span>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1 block">自定义规则描述</label>
              <textarea value={rulesDesc} onChange={(e) => setRulesDesc(e.target.value)}
                placeholder="可选：添加额外的规则说明，会在游戏中展示"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm resize-none" rows={2} maxLength={200} />
            </div>
          </div>
        )}

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
              if (cell.type === "end") return (
                <div key={cell.index} style={{ gridRow: cell.row, gridColumn: cell.col }}
                  className="flex items-center justify-center bg-stone-800 rounded-full">
                  <span className="text-amber-300 text-lg">★</span>
                </div>
              );
              const isStart = cell.type === "start";
              const isSelected = cell.index === selectedIdx;

              return (
                <div
                  key={cell.index}
                  style={{ gridRow: cell.row, gridColumn: cell.col }}
                  className={`relative border border-stone-300 flex items-center justify-center rounded-sm text-[8px] leading-tight text-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all ${isSelected ? "ring-2 ring-blue-500 z-10" : ""} ${isStart ? "cursor-default hover:ring-0 bg-white" : ""} ${cell.index === 24 ? "bg-amber-100" : ""}`}
                  onClick={() => handleCellClick(cell)}
                >
                  {isStart ? (
                    <span className="text-[11px]">🏁</span>
                  ) : cell.type === "halfway" ? (
                    <span className="text-amber-800 text-[8px]">{cell.label || "半程"}</span>
                  ) : cell.type === "fly" ? (
                    <span className="text-cyan-600 text-sm">✈</span>
                  ) : cell.type === "retreat" ? (
                    <span className="text-amber-600 text-sm">↩</span>
                  ) : cell.type === "safe" ? (
                    <span className="text-rose-500 text-xs">🛡</span>
                  ) : cell.label ? (
                    <span className="text-stone-600 px-0.5">{cell.label.length > 8 ? cell.label.slice(0, 8) + "…" : cell.label}</span>
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

        {/* Save / Save As */}
        {editId ? (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-stone-700 text-white rounded-xl font-semibold disabled:opacity-50 text-sm">
              {saving ? "保存中..." : "保存（覆盖）"}
            </button>
            <button onClick={handleSaveAs} disabled={saving} className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-semibold disabled:opacity-50 text-sm">
              另存为...
            </button>
          </div>
        ) : (
          <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold disabled:opacity-50">
            {saving ? "保存中..." : "保存棋盘"}
          </button>
        )}

        <button onClick={() => router.push("/board/new")} className="w-full text-sm text-stone-500 py-2">← 返回棋盘列表</button>
      </div>
    </main>
  );
}
