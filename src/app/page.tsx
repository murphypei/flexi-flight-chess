"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession, User } from "@/lib/auth";
import { getMyBoards, seedTemplates, updateBoard, BoardRecord } from "@/lib/db";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [myBoards, setMyBoards] = useState<BoardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [contentBoard, setContentBoard] = useState<BoardRecord | null>(null);
  const [rulesText, setRulesText] = useState("");
  const [cellsText, setCellsText] = useState("");

  useEffect(() => {
    const u = getSession();
    setUser(u);
    if (u) {
      seedTemplates().then(() => getMyBoards(u.id)).then((boards) => {
        setMyBoards(boards);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  function handleLogout() {
    clearSession();
    setUser(null);
    setMyBoards([]);
  }

  function handleJoin() {
    const nick = user ? user.username : name;
    if (!nick.trim()) { setError("请输入昵称"); return; }
    if (!code.trim()) { setError("请输入房间号"); return; }
    router.push(`/room/${code.toUpperCase()}?name=${encodeURIComponent(nick.trim())}`);
  }

  function openContentBoard(b: BoardRecord) {
    const r = b.rules || {};
    setRulesText(`flySteps: ${r.flySteps ?? 3}\nretreatSteps: ${r.retreatSteps ?? 2}\n${r.description || ""}`);
    const lines: string[] = [];
    for (const c of b.cells) {
      if (c.type === "normal" || c.type === "halfway") {
        lines.push(`${c.index}: ${c.label || ""}`);
      }
    }
    setCellsText(lines.join("\n"));
    setContentBoard(b);
  }

  async function handleBulkSave() {
    if (!contentBoard) return;
    let flySteps = 3, retreatSteps = 2, description = "";
    const rulesLines = rulesText.split("\n");
    for (let i = 0; i < rulesLines.length; i++) {
      const line = rulesLines[i];
      const m = line.match(/^(\w+):\s*(.*)/);
      if (m && m[1] === "flySteps") flySteps = parseInt(m[2]) || 3;
      else if (m && m[1] === "retreatSteps") retreatSteps = parseInt(m[2]) || 2;
      else if (i >= 2 || !m) {
        // Lines 3+ or non-key:value lines → description (strip old "description:" prefix)
        const d = line.startsWith("description: ") ? line.slice(13) : line;
        description += (description ? "\n" : "") + d;
      }
    }
    const labelMap: Record<number, string> = {};
    for (const line of cellsText.split("\n")) {
      const m = line.match(/^(\d+):\s*(.*)/);
      if (m) labelMap[parseInt(m[1])] = m[2];
    }
    const newCells = contentBoard.cells.map((c) =>
      c.index in labelMap && (c.type === "normal" || c.type === "halfway")
        ? { ...c, label: labelMap[c.index] }
        : c
    );
    try {
      const updates = { cells: newCells, rules: { flySteps, retreatSteps, description } };
      await updateBoard(contentBoard.id, updates);
      setMyBoards((prev) => prev.map((b) => b.id === contentBoard.id ? { ...b, cells: newCells, rules: { ...b.rules, flySteps, retreatSteps, description } } : b));
      setContentBoard(null);
    } catch (e: any) {
      alert("保存失败: " + (e.message || JSON.stringify(e)));
    }
  }

  async function handleCopyContent() {
    const text = rulesText + "\n---\n" + cellsText;
    await navigator.clipboard.writeText(text);
    alert("已复制");
  }

  // ============================================================
  // Logged-in view
  // ============================================================
  if (user) {
    return (
      <main className="min-h-screen p-4" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">飞行棋</h1>
              <p className="text-sm text-stone-500 mt-0.5">欢迎，{user.username}</p>
            </div>
            <button onClick={handleLogout} className="text-sm text-stone-500 hover:text-stone-700 px-3 py-1.5 rounded-lg border border-stone-300 bg-white">退出登录</button>
          </div>

          {/* 加入房间 */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-stone-500 uppercase mb-2">加入房间</h2>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
              {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm mb-3">{error}</div>}
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="输入房间号加入"
                  className="flex-1 px-4 py-3 rounded-xl border border-stone-300 focus:border-stone-700 focus:outline-none text-sm uppercase"
                  maxLength={6}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
                <button onClick={handleJoin} className="px-6 py-3 bg-stone-900 text-white rounded-xl font-semibold hover:bg-stone-800 text-sm">加入</button>
              </div>
            </div>
          </div>

          {/* 创建房间 */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-stone-500 uppercase mb-2">创建房间</h2>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => router.push("/board/new?mode=online")}
                className="p-4 rounded-xl border-2 border-stone-200 hover:border-stone-400 text-center bg-white transition-colors">
                <div className="font-semibold text-sm">联网对战</div>
                <div className="text-xs text-stone-500 mt-0.5">创建房间邀请好友</div>
              </button>
              <button onClick={() => router.push("/board/new?mode=local")}
                className="p-4 rounded-xl border-2 border-stone-200 hover:border-stone-400 text-center bg-white transition-colors">
                <div className="font-semibold text-sm">单机游戏</div>
                <div className="text-xs text-stone-500 mt-0.5">一台手机轮流玩</div>
              </button>
            </div>
          </div>

          {/* 我的棋盘 */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-stone-500 uppercase mb-2">我的棋盘</h2>
            {loading ? (
              <div className="text-center py-4"><div className="w-5 h-5 border-2 border-stone-700 border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : myBoards.length > 0 ? (
              <div className="space-y-2 mb-2">
                {myBoards.map((b) => (
                  <div key={b.id} className="flex items-stretch gap-2">
                    <div
                      className="flex-1 p-4 rounded-xl border-2 border-stone-200 text-left bg-white">
                      <div className="font-semibold">{b.name}</div>
                      <div className="text-xs text-stone-500 mt-1">{b.player_count}人{b.is_public ? " · 公开" : " · 私密"}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); openContentBoard(b); }}
                      className="px-3 rounded-xl border-2 border-stone-200 hover:border-stone-400 bg-white text-sm text-stone-600">📋</button>
                    <button onClick={() => router.push(`/board/edit?id=${b.id}`)}
                      className="px-3 rounded-xl border-2 border-stone-200 hover:border-stone-400 bg-white text-sm text-stone-600">✎</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400 py-3">还没有自定义棋盘</p>
            )}
            <button onClick={() => router.push("/board/edit")}
              className="w-full p-4 rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-500 text-left bg-white transition-colors">
              <div className="font-semibold">+ 自定义棋盘</div>
              <div className="text-xs text-stone-400 mt-1">从头创建，自定义格子内容和规则</div>
            </button>
          </div>
        </div>

        {/* Board content modal — bulk text editor */}
        {contentBoard && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setContentBoard(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-stone-200 shrink-0">
                <div>
                  <h2 className="font-bold text-lg">{contentBoard.name}</h2>
                  <p className="text-xs text-stone-500">{contentBoard.player_count}人 · 下方可整体编辑后保存</p>
                </div>
                <button onClick={() => setContentBoard(null)} className="text-stone-400 hover:text-stone-700 text-lg px-1">✕</button>
              </div>
              <div className="overflow-y-auto p-4 space-y-3">
                <div>
                  <div className="text-xs font-bold text-stone-500 mb-1">规则设置</div>
                  <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)}
                    className="w-full h-32 px-3 py-2 rounded-lg border border-stone-300 text-sm resize-none font-mono leading-relaxed" />
                  <p className="text-[10px] text-stone-400 mt-1">
                    前两行：flySteps 飞行步数 · retreatSteps 后退步数。第三行起：自定义规则内容，可多行
                  </p>
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-500 mb-1">棋盘内容（序号: 内容）</div>
                  <textarea value={cellsText} onChange={(e) => setCellsText(e.target.value)}
                    className="w-full h-48 px-3 py-2 rounded-lg border border-stone-300 text-sm resize-none font-mono leading-relaxed"
                    placeholder="1: 干一杯 🍻&#10;2: 唱一首歌" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleBulkSave} className="flex-1 py-2 bg-stone-900 text-white rounded-lg text-sm font-semibold">保存</button>
                  <button onClick={handleCopyContent} className="px-4 py-2 border border-stone-300 rounded-lg text-sm text-stone-600">复制</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ============================================================
  // Guest view
  // ============================================================
  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-8">飞行棋</h1>

        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>}

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-stone-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">昵称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的昵称"
              className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-stone-700 focus:outline-none text-sm"
              maxLength={12}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">房间号</label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="输入6位房间号"
                className="flex-1 px-4 py-3 rounded-xl border border-stone-300 focus:border-stone-700 focus:outline-none text-sm uppercase"
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <button onClick={handleJoin} className="px-6 py-3 bg-stone-900 text-white rounded-xl font-semibold hover:bg-stone-800 text-sm">加入</button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-4 text-sm text-stone-400">或</span></div>
          </div>

          <button
            onClick={() => router.push("/login")}
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold hover:bg-stone-800 text-sm"
          >
            登录 / 注册
          </button>
        </div>
      </div>
    </main>
  );
}
