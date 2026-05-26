"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Board from "@/components/Board";
import Dice from "@/components/Dice";
import {
  applyMove, Cell, GameState,
  initGameState, makePlayers, Player, rollDice, PIECE_COUNT,
} from "@/lib/board";
import { getBoard, seedTemplates } from "@/lib/db";

const PLAYER_HEX = ["#EF4444", "#3B82F6", "#22C55E", "#EAB308"];
const PLAYER_SOFT = ["#FEE2E2", "#DBEAFE", "#DCFCE7", "#FEF9C3"];

function LocalGame() {
  const router = useRouter();
  const params = useSearchParams();
  const boardId = params.get("board") || "";
  const playerCount = Math.max(1, Math.min(4, Number(params.get("players")) || 2));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [boardName, setBoardName] = useState("");
  const [cells, setCells] = useState<Cell[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [state, setState] = useState<GameState | null>(null);
  const [popup, setPopup] = useState<{ text: string; color: string } | null>(null);
  const rollingRef = useRef(false);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await seedTemplates();
        const board = await getBoard(boardId);
        if (!board) { setError("棋盘不存在"); setLoading(false); return; }

        setBoardName(board.name);
        setCells(board.cells);

        const gamePlayers = makePlayers(playerCount);
        setPlayers(gamePlayers);

        const gs = initGameState(playerCount);
        gs.message = gamePlayers[0].name + " 先手 · 点击骰子开始";
        setState(gs);

        setLoading(false);
      } catch (e: any) {
        setError(e.message || "加载失败");
        setLoading(false);
      }
    })();
  }, [boardId, playerCount]);

  function showPopup(msg: string, color: string) {
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    setPopup({ text: msg, color });
    popupTimerRef.current = setTimeout(() => setPopup(null), 30000);
  }

  function dismissPopup() {
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    setPopup(null);
  }

  function handleRoll() {
    if (!state || state.winner || state.isRolling || rollingRef.current) return;
    rollingRef.current = true;
    const currentState = state;
    setState((s) => s ? { ...s, isRolling: true } : null);
    setTimeout(() => {
      const value = rollDice();
      const newState = applyMove({ ...currentState, isRolling: false }, value, cells, players);
      setState(newState);
      if (newState.popupMessage) {
        showPopup(newState.popupMessage, PLAYER_HEX[newState.lastDicePlayer]);
      }
      rollingRef.current = false;
    }, 700);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100"><div className="w-8 h-8 border-2 border-stone-700 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100"><div className="text-center"><p className="text-red-500 mb-4">{error}</p><button onClick={() => router.push("/")} className="px-4 py-2 bg-stone-900 text-white rounded-lg">返回棋盘列表</button></div></div>;
  }
  if (!state) return null;

  const ringLen = cells.length - 1;
  const currentPlayer = state.currentPlayer;
  const showDiceValue = (state.isRolling || popup) ? state.diceValue : null;

  return (
    <main className="min-h-screen text-stone-800" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
      <div className="max-w-[500px] mx-auto px-4 py-4">
        {/* Header */}
        <header className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold leading-tight">单机游戏</h1>
            {boardName && <p className="text-xs text-stone-500">{boardName} · {playerCount}人</p>}
          </div>
          <button onClick={() => router.push("/")} className="text-sm font-semibold px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all shadow-sm">退出</button>
        </header>

        {/* Status bar */}
        <div className="mb-3 flex gap-3">
          <div className="flex-1 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: PLAYER_SOFT[currentPlayer] }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-bold shadow-md" style={{ backgroundColor: PLAYER_HEX[currentPlayer] }}>
              {players[currentPlayer]?.name[0]}
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: PLAYER_HEX[currentPlayer] }}>{players[currentPlayer]?.name}回合</p>
              <p className="text-xs text-stone-600">点击骰子</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-[56px] h-[56px]">
              <Dice value={showDiceValue} isRolling={state.isRolling} disabled={!!state.winner} onRoll={handleRoll} color={PLAYER_HEX[currentPlayer]} />
            </div>
            <div className="text-3xl font-bold tabular-nums w-8 text-right" style={{ color: showDiceValue !== null ? PLAYER_HEX[state.lastDicePlayer] : "#D4D4D4" }}>
              {showDiceValue ?? "—"}
            </div>
          </div>
        </div>

        {/* Board */}
        <div className="mb-4 relative">
          <Board cells={cells} state={state} players={players} />
          {popup && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 rounded-2xl">
              <div className="bg-white rounded-2xl px-6 py-5 mx-8 text-center shadow-xl max-w-sm">
                <p className="text-xl font-bold leading-relaxed mb-4" style={{ color: popup.color }}>{popup.text}</p>
                <button onClick={dismissPopup} className="px-6 py-2 bg-stone-900 text-white rounded-xl text-sm font-semibold">关闭</button>
              </div>
            </div>
          )}
        </div>

        {/* Players + progress */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 mb-4">
          <div className="space-y-3">
            {players.map((p, i) => {
              const piece = state.pieces[i];
              const steps = piece?.steps ?? 0;
              const arrived = state.endCount[i] ?? 0;
              const pct = (steps / ringLen) * 100;
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: PLAYER_HEX[p.id] }} />
                      <span className="text-sm font-medium">{p.name}</span>
                      {state.currentPlayer === i && !state.winner && <span className="text-[10px] font-bold" style={{ color: PLAYER_HEX[p.id] }}>回合中</span>}
                    </div>
                    <span className="text-xs text-stone-600 tabular-nums">{steps === ringLen ? "🏁" : `${steps}/${ringLen}`}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: PLAYER_HEX[p.id] }} />
                    </div>
                    {Array.from({ length: PIECE_COUNT }, (_, j) => (
                      <div key={j} className="w-2 h-2 rounded-full border" style={{
                        backgroundColor: j < arrived ? PLAYER_HEX[p.id] : "transparent",
                        borderColor: j < arrived ? PLAYER_HEX[p.id] : "#D4D4D4",
                      }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Winner message */}
        {state.winner !== null && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 text-center">
            <p className="text-xl font-bold" style={{ color: PLAYER_HEX[state.winner] }}>🎉 {players[state.winner].name} 获胜！</p>
            <button onClick={() => router.push("/")} className="mt-3 px-4 py-2 bg-stone-900 text-white rounded-lg text-sm">返回棋盘列表</button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function LocalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-stone-700 border-t-transparent rounded-full animate-spin" /></div>}>
      <LocalGame />
    </Suspense>
  );
}
