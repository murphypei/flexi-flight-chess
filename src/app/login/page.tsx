"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register, login, saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!username.trim() || !password) { setError("请填写用户名和密码"); return; }
    setError("");
    try {
      const user = isRegister
        ? await register(username.trim(), password)
        : await login(username.trim(), password);
      saveSession(user);
      router.back(); // go back to where user came from
    } catch (e: any) {
      setError(e.message || "操作失败");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
      <div className="bg-white rounded-2xl p-6 shadow-lg max-w-sm w-full">
        <h1 className="text-xl font-bold mb-4">{isRegister ? "注册" : "登录"}</h1>
        {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm mb-3">{error}</div>}
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-stone-700 focus:outline-none text-sm mb-3" maxLength={20} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:border-stone-700 focus:outline-none text-sm mb-4" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
        <button onClick={handleSubmit} className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold text-sm mb-3">{isRegister ? "注册" : "登录"}</button>
        <button onClick={() => { setIsRegister(!isRegister); setError(""); }} className="w-full text-sm text-stone-500">{isRegister ? "已有账号？去登录" : "没有账号？去注册"}</button>
        <button onClick={() => router.back()} className="w-full text-sm text-stone-400 mt-2">← 返回</button>
      </div>
    </main>
  );
}
