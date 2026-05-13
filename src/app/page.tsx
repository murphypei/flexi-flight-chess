"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleJoin() {
    if (!name.trim()) { setError("请输入昵称"); return; }
    if (!code.trim()) { setError("请输入房间号"); return; }
    router.push(`/room/${code.toUpperCase()}?name=${encodeURIComponent(name.trim())}`);
  }

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
              />
              <button onClick={handleJoin} className="px-6 py-3 bg-stone-900 text-white rounded-xl font-semibold hover:bg-stone-800 text-sm">加入</button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-4 text-sm text-stone-400">或</span></div>
          </div>

          <button
            onClick={() => router.push("/board/new")}
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold hover:bg-stone-800 text-sm"
          >
            创建新房间
          </button>
        </div>
      </div>
    </main>
  );
}
