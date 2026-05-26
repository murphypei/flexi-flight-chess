"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { seedTemplates, getTemplates, getMyBoards, getPublicBoards, createRoom, BoardRecord } from "@/lib/db";
import { getSession, clearSession, User } from "@/lib/auth";

export default function NewBoardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [templates, setTemplates] = useState<BoardRecord[]>([]);
  const [myBoards, setMyBoards] = useState<BoardRecord[]>([]);
  const [publicBoards, setPublicBoards] = useState<BoardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [selectedBoard, setSelectedBoard] = useState<BoardRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [localCount, setLocalCount] = useState(2);
  const [showLocalConfig, setShowLocalConfig] = useState(false);
  const [mode, setMode] = useState<"online" | "local" | null>(null);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "online" || m === "local") setMode(m);
    if (m === "local") setShowLocalConfig(true);
  }, []);

  useEffect(() => {
    setUser(getSession());
  }, []);

  useEffect(() => {
    const load = async () => {
      await seedTemplates();
      const u = getSession();
      const [tmpl, publicB] = await Promise.all([getTemplates(), getPublicBoards()]);
      setTemplates(tmpl);
      setPublicBoards(publicB.filter((b) => b.owner_id !== u?.id));
      if (u) setMyBoards(await getMyBoards(u.id));
      setLoading(false);
    };
    load();
  }, [user]);

  function handleSelect(board: BoardRecord) {
    if (selectedBoard?.id === board.id) {
      setSelectedBoard(null);
      setShowLocalConfig(false);
    } else {
      setSelectedBoard(board);
      setLocalCount(board.player_count);
      setShowLocalConfig(false);
    }
  }

  async function handleOnline() {
    if (!selectedBoard) return;
    if (!name.trim()) { alert("请输入昵称"); return; }
    setCreating(true);
    try {
      const playerId = getSession()?.id || ("guest_" + Date.now());
      const { code } = await createRoom(selectedBoard.id, playerId, name.trim(), selectedBoard.player_count);
      router.push(`/room/${code}?name=${encodeURIComponent(name.trim())}`);
    } catch (e: any) {
      alert(e.message || "创建失败");
      setCreating(false);
    }
  }

  function handleLocal() {
    if (!selectedBoard) return;
    router.push(`/local?board=${selectedBoard.id}&players=${localCount}`);
  }

  const twoPlayer = templates.filter((t) => t.player_count === 2);
  const fourPlayer = templates.filter((t) => t.player_count === 4);

  const boardButton = (b: BoardRecord) => {
    const isSelected = selectedBoard?.id === b.id;
    return (
      <button
        key={b.id}
        onClick={() => handleSelect(b)}
        className={`w-full p-4 rounded-xl border-2 text-center transition-all ${
          isSelected
            ? "border-stone-700 bg-stone-100 ring-2 ring-stone-300"
            : "border-stone-200 hover:border-stone-400 bg-white"
        }`}
      >
        <div className="font-semibold">{b.name}</div>
        <div className="text-xs text-stone-500 mt-1">{b.player_count}人{b.is_public ? " · 公开" : " · 私密"}</div>
      </button>
    );
  };

  return (
    <main className="min-h-screen p-4 pb-32" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push("/")} className="text-sm text-stone-500">← 返回</button>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-stone-600">{user.username}</span>
              <button onClick={() => { clearSession(); setUser(null); }} className="text-xs text-stone-400">退出</button>
            </div>
          ) : (
            <button onClick={() => router.push("/login")} className="text-sm font-medium text-stone-700">登录 / 注册</button>
          )}
        </div>

        <h1 className="text-2xl font-bold mb-6">
          {mode === "online" ? "创建联网房间" : mode === "local" ? "创建单机游戏" : "选择棋盘"}
        </h1>

        {/* Nickname (only for online mode) */}
        {mode !== "local" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-stone-700 mb-1">昵称（联网需要）</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的昵称" className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-stone-700 focus:outline-none text-sm" maxLength={12} />
          </div>
        )}

        {loading ? (
          <div className="text-center py-8"><div className="w-6 h-6 border-2 border-stone-700 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-6">
            {/* My boards */}
            {user && myBoards.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-stone-500 uppercase mb-2">我的棋盘</h2>
                <div className="space-y-2">
                  {myBoards.map((b) => boardButton(b))}
                </div>
              </div>
            )}

            {/* Public boards from others */}
            {publicBoards.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-stone-500 uppercase mb-2">公开棋盘</h2>
                <div className="space-y-2">
                  {publicBoards.map((b) => boardButton(b))}
                </div>
              </div>
            )}

            {/* Built-in templates */}
            {twoPlayer.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-stone-500 uppercase mb-2">双人棋盘</h2>
                <div className="space-y-2">
                  {twoPlayer.map((t) => boardButton(t))}
                </div>
              </div>
            )}
            {fourPlayer.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-stone-500 uppercase mb-2">四人棋盘</h2>
                <div className="space-y-2">
                  {fourPlayer.map((t) => boardButton(t))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar — visible when a board is selected */}
      {selectedBoard && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-stone-200 shadow-lg z-40">
          <div className="max-w-md mx-auto space-y-3">
            <div className="text-center text-sm text-stone-600">
              已选择：<span className="font-semibold text-stone-900">{selectedBoard.name}</span> · {selectedBoard.player_count}人
            </div>

            {mode === "online" ? (
              <button onClick={handleOnline} disabled={creating}
                className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold disabled:opacity-50 text-sm">
                {creating ? "创建中..." : "开始联网对战"}
              </button>
            ) : mode === "local" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 justify-center">
                  <label className="text-sm text-stone-600">游戏人数</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} onClick={() => setLocalCount(n)}
                        className={`w-10 h-10 rounded-lg text-sm font-semibold border-2 transition-all ${
                          localCount === n ? "border-stone-700 bg-stone-100" : "border-stone-200 hover:border-stone-400 bg-white"
                        }`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
                <button onClick={handleLocal}
                  className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold text-sm">开始单机游戏</button>
              </div>
            ) : !showLocalConfig ? (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleOnline} disabled={creating}
                  className="py-3 bg-stone-900 text-white rounded-xl font-semibold disabled:opacity-50 text-sm">
                  {creating ? "创建中..." : "联网对战"}
                </button>
                <button onClick={() => setShowLocalConfig(true)}
                  className="py-3 border-2 border-stone-700 text-stone-700 rounded-xl font-semibold text-sm">
                  单机游戏
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 justify-center">
                  <label className="text-sm text-stone-600">游戏人数</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} onClick={() => setLocalCount(n)}
                        className={`w-10 h-10 rounded-lg text-sm font-semibold border-2 transition-all ${
                          localCount === n ? "border-stone-700 bg-stone-100" : "border-stone-200 hover:border-stone-400 bg-white"
                        }`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowLocalConfig(false)}
                    className="flex-1 py-3 border-2 border-stone-200 text-stone-600 rounded-xl font-semibold text-sm">← 返回</button>
                  <button onClick={handleLocal}
                    className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-semibold text-sm">开始游戏</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
