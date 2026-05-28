"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Board from "@/components/Board";
import Dice from "@/components/Dice";
import {
  applyMove, Cell, GameState,
  initGameState, makePlayers, Player, rollDice, PIECE_COUNT,
} from "@/lib/board";
import {
  getRoomByCode, getBoard, getRoomPlayers, joinRoom,
  updateRoom, subscribeRoom, subscribePlayers, PlayerRecord, seedTemplates, updatePlayer, deletePlayer,
} from "@/lib/db";

const PLAYER_HEX = ["#EF4444", "#3B82F6", "#22C55E", "#EAB308"];
const PLAYER_SOFT = ["#FEE2E2", "#DBEAFE", "#DCFCE7", "#FEF9C3"];

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [boardName, setBoardName] = useState("");
  const [playerCount, setPlayerCount] = useState(2);  // board design player count
  const [activeCount, setActiveCount] = useState(2);   // actual players in game
  const [myPlayerIdx, setMyPlayerIdx] = useState(-1);
  const [myName, setMyName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomPlayers, setRoomPlayers] = useState<PlayerRecord[]>([]);
  const [state, setState] = useState<GameState | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [flySteps, setFlySteps] = useState(3);
  const [retreatSteps, setRetreatSteps] = useState(2);
  const [rulesDesc, setRulesDesc] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [popup, setPopup] = useState<{ text: string; color: string } | null>(null);
  const [roomId, setRoomId] = useState("");
  const rollingRef = useRef(false);
  const roomIdRef = useRef("");
  const gameStartedRef = useRef(false);
  const mountedRef = useRef(true);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get("name") || "";
    setMyName(name);
    loadRoom(name);
  }, []);

  async function loadRoom(name: string) {
    try {
      await seedTemplates();
      const room = await getRoomByCode(code);
      if (!room) { setError("房间不存在"); setLoading(false); return; }
      roomIdRef.current = room.id;
      setRoomId(room.id);

      const board = await getBoard(room.board_id);
      if (!board) { setError("棋盘不存在"); setLoading(false); return; }

      setBoardName(board.name);
      setPlayerCount(board.player_count);
      setCells(board.cells);
      if (board.rules?.flySteps) setFlySteps(board.rules.flySteps);
      if (board.rules?.retreatSteps) setRetreatSteps(board.rules.retreatSteps);
      if (board.rules?.description) setRulesDesc(board.rules.description);

      let rp = await getRoomPlayers(room.id);

      // Find or join
      let me = rp.find((p: PlayerRecord) => p.name === name) ?? null;
      if (!me && name && rp.length < board.player_count) {
        me = await joinRoom(room.id, name);
        rp = await getRoomPlayers(room.id);
      }
      setRoomPlayers(rp);
      setMyPlayerIdx(me ? me.player_index : -1);

      // Use actual player count for game logic, not board design count
      const actualCount = rp.length || 1;
      setActiveCount(actualCount);

      const gamePlayers = makePlayers(actualCount);
      setPlayers(gamePlayers);

      if (room.game_state && room.game_state.pieces) {
        const gs = room.game_state as GameState;
        if (!gs.ready) gs.ready = new Array(gs.pieces.length).fill(true);
        setState(gs);
        gameStartedRef.current = true;
      } else {
        setState(initGameState(actualCount));
      }

      if (!mountedRef.current) return;
      setLoading(false);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e.message || "加载失败");
      setLoading(false);
    }
  }

  function showPopup(msg: string, color: string) {
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    setPopup({ text: msg, color });
    popupTimerRef.current = setTimeout(() => setPopup(null), 2500);
  }

  // Realtime subscriptions
  useEffect(() => {
    if (!roomIdRef.current) return;
    const unsub1 = subscribeRoom(roomIdRef.current, async (payload: any) => {
      const gs = payload.new?.game_state as GameState | undefined;
      if (gs) {
        setState(gs);
        if (gs.popupMessage && !gs.isRolling && gs.diceValue !== null) {
          showPopup(gs.popupMessage, PLAYER_HEX[gs.lastDicePlayer]);
        }
      }
    });
    const unsub2 = subscribePlayers(roomIdRef.current, async () => {
      const rp = await getRoomPlayers(roomIdRef.current);
      setRoomPlayers(rp);
      if (!gameStartedRef.current && rp.length > 0) {
        setActiveCount(rp.length);
        setPlayers(makePlayers(rp.length));
      }
    });
    return () => { unsub1?.unsubscribe(); unsub2?.unsubscribe(); };
  }, [roomId]);

  function handleRoll() {
    if (!state || state.winner || state.isRolling || rollingRef.current) return;
    if (state.currentPlayer !== myPlayerIdx) return;
    rollingRef.current = true;
    const currentState = state;
    setState((s) => s ? { ...s, isRolling: true } : null);
    setTimeout(() => {
      const value = rollDice();
      const gamePlayers = makePlayers(activeCount);
      const newState = applyMove({ ...currentState, isRolling: false }, value, cells, gamePlayers);
      setState(newState);
      if (newState.popupMessage) {
        showPopup(newState.popupMessage, PLAYER_HEX[newState.lastDicePlayer]);
      }
      // Sync to Supabase
      updateRoom(roomIdRef.current, { game_state: newState, status: newState.winner !== null ? "finished" : "playing" })
        .catch(() => {}); // fail silently: next roll re-syncs state
      rollingRef.current = false;
    }, 700);
  }

  function handleReady() {
    if (myPlayerIdx < 0) return;
    const current = roomPlayers[myPlayerIdx]?.is_ready ?? false;
    updatePlayer(roomIdRef.current, myPlayerIdx, { is_ready: !current }).catch(() => {});
  }

  function handleStartGame() {
    if (!state) return;
    gameStartedRef.current = true;
    const gamePlayers = makePlayers(activeCount);
    const newState: GameState = { ...initGameState(activeCount), ...state, message: "游戏开始！掷 1、2、3 出发，" + gamePlayers[0].name + " 先手" };
    setState(newState);
    updateRoom(roomIdRef.current, { game_state: newState, status: "playing" }).catch(() => {});
  }

  async function handleLeave() {
    if (myPlayerIdx >= 0 && roomIdRef.current) {
      await deletePlayer(roomIdRef.current, myPlayerIdx).catch(() => {});
    }
    router.push("/");
  }

  // Clean up player record on tab close (best-effort)
  useEffect(() => {
    const handler = () => {
      if (roomIdRef.current && myPlayerIdx >= 0) {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/players?room_id=eq.${roomIdRef.current}&player_index=eq.${myPlayerIdx}`;
        fetch(url, { method: "DELETE", keepalive: true, headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}` } }).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [myPlayerIdx]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100"><div className="w-8 h-8 border-2 border-stone-700 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100"><div className="text-center"><p className="text-red-500 mb-4">{error}</p><button onClick={() => router.push("/")} className="px-4 py-2 bg-stone-900 text-white rounded-lg">返回首页</button></div></div>;
  }
  if (!state) return null;

  const gamePlayers = makePlayers(activeCount);
  const ringLen = cells.length - 1;
  const currentPlayer = state.currentPlayer;
  const winner = state.winner;

  return (
    <main className="min-h-screen text-stone-800" style={{ background: "linear-gradient(135deg, #FEF3E2 0%, #FDF8EE 50%, #F0F4FF 100%)" }}>
      <div className="max-w-[500px] mx-auto px-4 py-4">
        {/* Header */}
        <header className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <div>
              <h1 className="text-xl font-bold leading-tight">飞行棋</h1>
              {boardName && <p className="text-xs text-stone-500">{boardName} · {playerCount}人</p>}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(code); alert("已复制"); }} className="text-sm font-bold text-stone-700 bg-white px-3 py-1 rounded-lg tracking-widest">
              {code} 📋
            </button>
          </div>
          <button onClick={handleLeave} className="text-sm font-semibold px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all shadow-sm">退出房间</button>
        </header>

        {/* Status bar */}
        <div className="mb-3 flex gap-3">
          <div className="flex-1 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: PLAYER_SOFT[currentPlayer] }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-bold shadow-md" style={{ backgroundColor: PLAYER_HEX[currentPlayer] }}>
              {gamePlayers[currentPlayer]?.name[0]}
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: PLAYER_HEX[currentPlayer] }}>{gamePlayers[currentPlayer]?.name}回合</p>
              <p className="text-xs text-stone-600">{state.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-[56px] h-[56px]">
              <Dice value={state.diceValue} isRolling={state.isRolling} disabled={!!winner || currentPlayer !== myPlayerIdx} onRoll={handleRoll} color={PLAYER_HEX[currentPlayer]} />
            </div>
            <div className="text-3xl font-bold tabular-nums w-8 text-right" style={{ color: state.diceValue !== null ? PLAYER_HEX[state.lastDicePlayer] : "#D4D4D4" }}>
              {state.diceValue ?? "—"}
            </div>
          </div>
        </div>

        {/* Board */}
        <div className="mb-4 relative">
          <Board cells={cells} state={state} players={gamePlayers} />
          {popup && (
            <div className="absolute bottom-2 left-2 right-2 z-50 flex justify-center pointer-events-none">
              <div className="bg-white rounded-2xl px-5 py-3 shadow-lg border border-stone-200 pointer-events-auto text-center animate-bounce cursor-pointer" onClick={() => { if (popupTimerRef.current) clearTimeout(popupTimerRef.current); setPopup(null); }}>
                <p className="text-base font-bold" style={{ color: popup.color }}>{popup.text}</p>
              </div>
            </div>
          )}
        </div>

        {/* Players + progress */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 mb-4">
          <div className="space-y-3">
            {gamePlayers.map((p, i) => {
              const rp = roomPlayers.find((x) => x.player_index === i);
              const piece = state.pieces[i];
              const steps = piece?.steps ?? 0;
              const arrived = state.endCount[i] ?? 0;
              const pct = (steps / ringLen) * 100;
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: PLAYER_HEX[p.id] }} />
                      <span className="text-sm font-medium">{rp ? rp.name : "等待加入..."}</span>
                      {rp?.is_host && <span className="text-[10px] text-stone-400">房主</span>}
                      {state.currentPlayer === i && !winner && <span className="text-[10px] font-bold" style={{ color: PLAYER_HEX[p.id] }}>回合中</span>}
                      {!state.ready?.[i] && !winner && <span className="text-[10px] text-stone-400">未出发</span>}
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

        {/* Ready / Start */}
        {winner === null && state.endCount.every((c: number) => c === 0) && state.pieces.every((p: { steps: number }) => p.steps === 0) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 mb-4 space-y-3">
            {roomPlayers.length < playerCount && <p className="text-sm text-stone-500 text-center">等待更多玩家加入 ({roomPlayers.length}/{playerCount})</p>}
            {myPlayerIdx >= 0 && !roomPlayers[myPlayerIdx]?.is_ready && (
              <button onClick={handleReady} className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold">准备</button>
            )}
            {myPlayerIdx >= 0 && roomPlayers[myPlayerIdx]?.is_ready && (
              <button onClick={handleReady} className="w-full py-3 border-2 border-stone-300 text-stone-600 rounded-xl font-semibold bg-stone-50">取消准备</button>
            )}
            {myPlayerIdx === 0 && roomPlayers.length >= 1 && roomPlayers.every((p: PlayerRecord) => p.is_ready || p.is_host) && (
              <button onClick={handleStartGame} className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold">开始游戏</button>
            )}
          </div>
        )}

        {/* Rules toggle & panel */}
        <div className="mb-3">
          <button onClick={() => setShowRules(!showRules)} className="text-sm text-stone-500 hover:text-stone-700 bg-white px-3 py-1.5 rounded-lg border border-stone-200">
            {showRules ? "▲ 收起规则" : "📋 本局规则"}
          </button>
          {showRules && (
            <div className="mt-2 bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-stone-50 rounded-xl p-3">
                  <div className="text-xs text-stone-500 mb-0.5">棋盘名称</div>
                  <div className="font-semibold">{boardName}</div>
                </div>
                <div className="bg-stone-50 rounded-xl p-3">
                  <div className="text-xs text-stone-500 mb-0.5">游戏人数</div>
                  <div className="font-semibold">{playerCount} 人</div>
                </div>
                <div className="bg-cyan-50 rounded-xl p-3">
                  <div className="text-xs text-cyan-600 mb-0.5">✈ 飞行格子</div>
                  <div className="font-semibold text-cyan-700">落地后前进 {flySteps} 步</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <div className="text-xs text-amber-600 mb-0.5">↩ 后退格子</div>
                  <div className="font-semibold text-amber-700">落地后退回 {retreatSteps} 步</div>
                </div>
                <div className="bg-rose-50 rounded-xl p-3">
                  <div className="text-xs text-rose-600 mb-0.5">🛡 安全区</div>
                  <div className="font-semibold text-rose-700">不会被撞飞</div>
                </div>
                <div className="bg-stone-50 rounded-xl p-3">
                  <div className="text-xs text-stone-500 mb-0.5">★ 终点</div>
                  <div className="font-semibold">超出步数会反弹</div>
                </div>
              </div>
              {rulesDesc && (
                <div className="mt-3 text-xs text-stone-600 bg-stone-50 rounded-lg p-2 whitespace-pre-wrap">{rulesDesc}</div>
              )}
              <div className="mt-3 text-xs text-stone-400 space-y-1">
                <p>出发规则：棋子初始为准备状态，需掷出 1、2、3 才能出发。出发当回合留在起点，下回合开始前进。</p>
                <p>碰撞规则：踩到对手格→对手回退。未过半程（24格前）的棋子撞回起点；已过半程的棋子撞回半程（黄色格）。安全区和起点不受碰撞。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
