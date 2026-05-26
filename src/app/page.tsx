"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession, User } from "@/lib/auth";
import { getMyBoards, seedTemplates, createRoom, BoardRecord } from "@/lib/db";
import { Cell, CellType } from "@/lib/board";

const TYPE_LABEL: Record<CellType, string> = {
  normal: "普通", start: "起点", safe: "安全", fly: "飞行", retreat: "后退", end: "终点",
};

const TYPE_ICON: Record<CellType, string> = {
  normal: "", start: "★", safe: "🛡", fly: "✈", retreat: "↩", end: "★",
};

function cellSummary(c: Cell, flySteps: number, retreatSteps: number) {
  if (c.type === "start") return "起点";
  if (c.type === "end") return "终点 ★";
  if (c.type === "fly") return `飞行 +${flySteps}`;
  if (c.type === "retreat") return `后退 ${retreatSteps} 步`;
  if (c.type === "safe") return "安全区";
  return c.label || "空白";
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [myBoards, setMyBoards] = useState<BoardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [contentBoard, setContentBoard] = useState<BoardRecord | null>(null);

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

  async function handleCreateRoom(board: BoardRecord) {
    if (!user) return;
    try {
      const { code } = await createRoom(board.id, user.id, user.username, board.player_count);
      router.push(`/room/${code}?name=${encodeURIComponent(user.username)}`);
    } catch (e: any) {
      alert(e.message || "创建失败");
    }
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
                    <button onClick={() => handleCreateRoom(b)}
                      className="flex-1 p-4 rounded-xl border-2 border-stone-200 hover:border-stone-400 text-left bg-white transition-colors">
                      <div className="font-semibold">{b.name}</div>
                      <div className="text-xs text-stone-500 mt-1">{b.player_count}人{b.is_public ? " · 公开" : " · 私密"}</div>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setContentBoard(b); }}
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

        {/* Board content modal */}
        {contentBoard && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setContentBoard(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[70vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-stone-200">
                <div>
                  <h2 className="font-bold text-lg">{contentBoard.name}</h2>
                  <p className="text-xs text-stone-500">{contentBoard.player_count}人 · {contentBoard.cells.length} 格</p>
                </div>
                <button onClick={() => setContentBoard(null)} className="text-stone-400 hover:text-stone-700 text-lg px-1">✕</button>
              </div>
              <div className="overflow-y-auto p-4 space-y-1">
                {(() => {
                  const groups: Record<CellType, Cell[]> = { normal: [], start: [], safe: [], fly: [], retreat: [], end: [] };
                  for (const c of contentBoard.cells) {
                    groups[c.type].push(c);
                  }
                  const flySteps = contentBoard.rules?.flySteps ?? 3;
                  const retreatSteps = contentBoard.rules?.retreatSteps ?? 2;
                  const order: CellType[] = ["start", "end", "fly", "retreat", "safe", "normal"];
                  return order.map((type) => {
                    const list = groups[type];
                    if (list.length === 0) return null;
                    return (
                      <div key={type} className="mb-3">
                        <div className="text-xs font-bold text-stone-500 uppercase mb-1">{TYPE_ICON[type]} {TYPE_LABEL[type]}（{list.length}）</div>
                        {list.map((c) => (
                          <div key={c.index} className="flex items-center gap-2 py-1 px-2 rounded-lg text-sm hover:bg-stone-50">
                            <span className="text-stone-400 text-xs w-6 tabular-nums">#{c.index}</span>
                            <span className="flex-1">{cellSummary(c, flySteps, retreatSteps)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
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
