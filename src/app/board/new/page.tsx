"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { seedTemplates, getTemplates, getMyBoards, getPublicBoards, createRoom, deleteBoard, BoardRecord } from "@/lib/db";
import { getSession, clearSession, User } from "@/lib/auth";

export default function NewBoardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [templates, setTemplates] = useState<BoardRecord[]>([]);
  const [myBoards, setMyBoards] = useState<BoardRecord[]>([]);
  const [publicBoards, setPublicBoards] = useState<BoardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

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

  async function handleCreate(board: BoardRecord) {
    if (!name.trim()) { alert("请输入昵称"); return; }
    setCreating(true);
    try {
      const playerId = "host_" + Date.now();
      const { code } = await createRoom(board.id, playerId, name.trim(), board.player_count);
      router.push(`/room/${code}?name=${encodeURIComponent(name.trim())}`);
    } catch (e: any) {
      alert(e.message || "创建失败");
      setCreating(false);
    }
  }

  const twoPlayer = templates.filter((t) => t.player_count === 2);
  const fourPlayer = templates.filter((t) => t.player_count === 4);

  return (
    <main className="min-h-screen p-4" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
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

        <h1 className="text-2xl font-bold mb-6">创建新房间</h1>

        <div className="mb-4">
          <label className="block text-sm font-medium text-stone-700 mb-1">昵称</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的昵称" className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-stone-700 focus:outline-none text-sm" maxLength={12} />
        </div>

        {loading ? (
          <div className="text-center py-8"><div className="w-6 h-6 border-2 border-stone-700 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-6">
            {/* My boards */}
            {user && myBoards.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-stone-500 uppercase mb-2">我的棋盘</h2>
                <div className="space-y-2">
                  {myBoards.map((b) => (
                    <div key={b.id} className="flex items-stretch gap-2">
                      <button onClick={() => handleCreate(b)} disabled={creating}
                        className="flex-1 p-4 rounded-xl border-2 border-stone-200 hover:border-stone-400 text-left bg-white transition-colors">
                        <div className="font-semibold">{b.name}</div>
                        <div className="text-xs text-stone-500 mt-1">{b.player_count}人 {b.is_public ? "· 公开" : "· 私密"}</div>
                      </button>
                      <button onClick={() => router.push(`/board/edit?id=${b.id}`)}
                        className="px-3 rounded-xl border-2 border-stone-200 hover:border-stone-400 bg-white text-sm text-stone-600">✎</button>
                      <button onClick={async () => { if (confirm(`删除「${b.name}」？`)) { await deleteBoard(b.id); setMyBoards((p) => p.filter((x) => x.id !== b.id)); } }}
                        className="px-3 rounded-xl border-2 border-stone-200 hover:border-red-400 bg-white text-sm text-stone-400 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Public boards from others */}
            {publicBoards.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-stone-500 uppercase mb-2">公开棋盘</h2>
                <div className="space-y-2">
                  {publicBoards.map((b) => (
                    <button key={b.id} onClick={() => handleCreate(b)} disabled={creating}
                      className="w-full p-4 rounded-xl border-2 border-stone-200 hover:border-stone-400 text-left bg-white transition-colors">
                      <div className="font-semibold">{b.name}</div>
                      <div className="text-xs text-stone-500 mt-1">{b.player_count}人 · 自定义</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Built-in templates */}
            {twoPlayer.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-stone-500 uppercase mb-2">双人棋盘</h2>
                <div className="space-y-2">
                  {twoPlayer.map((t) => (
                    <button key={t.id} onClick={() => handleCreate(t)} disabled={creating}
                      className="w-full p-4 rounded-xl border-2 border-stone-200 hover:border-stone-400 text-left bg-white transition-colors">
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-xs text-stone-500 mt-1">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {fourPlayer.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-stone-500 uppercase mb-2">四人棋盘</h2>
                <div className="space-y-2">
                  {fourPlayer.map((t) => (
                    <button key={t.id} onClick={() => handleCreate(t)} disabled={creating}
                      className="w-full p-4 rounded-xl border-2 border-stone-200 hover:border-stone-400 text-left bg-white transition-colors">
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-xs text-stone-500 mt-1">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom board — need login */}
            <button onClick={() => {
              if (!getSession()) { router.push("/login"); return; }
              router.push("/board/edit");
            }} className="w-full p-4 rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-500 text-left text-stone-600 bg-white">
              <div className="font-semibold">{user ? "+ 自定义棋盘" : "登录后可自定义棋盘"}</div>
              <div className="text-xs text-stone-400 mt-1">从头创建，自定义格子内容和规则</div>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
