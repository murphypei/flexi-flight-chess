"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Board from "@/components/Board";
import Dice from "@/components/Dice";
import {
  applyMove, buildCells, Cell, getCellContent, GameState,
  getPieceCellIndex, initGameState, makePlayers, Player, rollDice, RING_LENGTH, PIECE_COUNT,
} from "@/lib/board";
import {
  getRoomByCode, getBoard, getRoomPlayers, joinRoom,
  updateRoom, subscribeRoom, subscribePlayers, PlayerRecord, seedTemplates, updatePlayer,
} from "@/lib/db";

const PLAYER_HEX = ["#EF4444", "#3B82F6", "#22C55E", "#EAB308"];
const PLAYER_SOFT = ["#FEE2E2", "#DBEAFE", "#DCFCE7", "#FEF9C3"];

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [boardId, setBoardId] = useState("");
  const [boardName, setBoardName] = useState("");
  const [playerCount, setPlayerCount] = useState(2);
  const [myPlayerIdx, setMyPlayerIdx] = useState(-1);
  const [myName, setMyName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomPlayers, setRoomPlayers] = useState<PlayerRecord[]>([]);
  const [state, setState] = useState<GameState | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [popup, setPopup] = useState<{ text: string; color: string } | null>(null);
  const rollingRef = useRef(false);
  const roomIdRef = useRef("");

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

      const board = await getBoard(room.board_id);
      if (!board) { setError("棋盘不存在"); setLoading(false); return; }

      setBoardId(board.id);
      setBoardName(board.name);
      setPlayerCount(board.player_count);
      setCells(board.cells);
      if (board.rules) {
        // buildCells with custom labels
        setCells(buildCells({}, {
          flyCells: board.rules.flyCells,
          retreatCells: board.rules.retreatCells,
          safeCells: board.rules.safeCells,
        }, board.player_count));
      }

      const rp = await getRoomPlayers(room.id);
      setRoomPlayers(rp);

      // Find or join
      let me = rp.find((p: PlayerRecord) => p.name === name) ?? null;
      if (!me && name && rp.length < board.player_count) {
        me = await joinRoom(room.id, name);
        const updated = await getRoomPlayers(room.id);
        setRoomPlayers(updated);
      }
      setMyPlayerIdx(me ? me.player_index : -1);

      const gamePlayers = makePlayers(board.player_count as 2 | 4);
      setPlayers(gamePlayers);

      if (room.game_state && room.game_state.pieces) {
        setState(room.game_state as GameState);
      } else {
        setState(initGameState(board.player_count));
      }

      setLoading(false);
    } catch (e: any) {
      setError(e.message || "加载失败");
      setLoading(false);
    }
  }

  // Realtime subscriptions
  useEffect(() => {
    if (!roomIdRef.current) return;
    const unsub1 = subscribeRoom(roomIdRef.current, async (payload: any) => {
      const gs = payload.new?.game_state as GameState | undefined;
      if (gs) {
        setState(gs);
        // Show popup for non-acting players too
        if (gs.popupMessage && !gs.isRolling && gs.diceValue !== null && gs.winner === null) {
          setPopup({ text: gs.popupMessage, color: PLAYER_HEX[gs.lastDicePlayer] });
        }
      }
    });
    const unsub2 = subscribePlayers(roomIdRef.current, async () => {
      const rp = await getRoomPlayers(roomIdRef.current);
      setRoomPlayers(rp);
    });
    return () => { unsub1?.unsubscribe(); unsub2?.unsubscribe(); };
  }, [roomIdRef.current]);

  function handleRoll() {
    if (!state || state.winner || state.isRolling || rollingRef.current) return;
    if (state.currentPlayer !== myPlayerIdx) return;
    rollingRef.current = true;
    const currentState = state;
    setState((s) => s ? { ...s, isRolling: true } : null);
    setTimeout(() => {
      const value = rollDice();
      const gamePlayers = makePlayers(playerCount as 2 | 4);
      const newState = applyMove({ ...currentState, isRolling: false }, value, cells, gamePlayers);
      setState(newState);
      if (newState.popupMessage) {
        setPopup({ text: newState.popupMessage, color: PLAYER_HEX[newState.lastDicePlayer] });
      }
      // Sync to Supabase
      updateRoom(roomIdRef.current, { game_state: newState, status: newState.winner !== null ? "finished" : "playing" });
      rollingRef.current = false;
    }, 700);
  }

  function handleReady() {
    if (myPlayerIdx < 0) return;
    updatePlayer(roomIdRef.current, myPlayerIdx, { is_ready: true } as any);
  }

  function handleStartGame() {
    if (!state) return;
    const gamePlayers = makePlayers(playerCount as 2 | 4);
    const newState: GameState = { ...initGameState(playerCount), ...state, message: "游戏开始！" + gamePlayers[0].name + " 请掷骰子" };
    setState(newState);
    updateRoom(roomIdRef.current, { game_state: newState, status: "playing" });
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100"><div className="w-8 h-8 border-2 border-stone-700 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100"><div className="text-center"><p className="text-red-500 mb-4">{error}</p><button onClick={() => router.push("/")} className="px-4 py-2 bg-stone-900 text-white rounded-lg">返回首页</button></div></div>;
  }
  if (!state) return null;

  const gamePlayers = makePlayers(playerCount as 2 | 4);
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
          <button onClick={() => router.push("/")} className="text-sm font-semibold px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all shadow-sm">退出房间</button>
        </header>

        {/* Status bar */}
        <div className="mb-3 flex gap-3">
          <div className="flex-1 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: PLAYER_SOFT[currentPlayer] }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-bold shadow-md" style={{ backgroundColor: PLAYER_HEX[currentPlayer] }}>
              {gamePlayers[currentPlayer]?.name[0]}
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: PLAYER_HEX[currentPlayer] }}>{gamePlayers[currentPlayer]?.name}回合</p>
              <p className="text-xs text-stone-600">点击骰子</p>
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
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 rounded-2xl" onClick={() => setPopup(null)}>
              <div className="bg-white rounded-2xl px-6 py-5 mx-8 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
                <p className="text-xl font-bold leading-relaxed" style={{ color: popup.color }}>{popup.text}</p>
                <p className="text-base text-stone-500 mt-4">点击任意处关闭</p>
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
              const pct = (steps / RING_LENGTH) * 100;
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: PLAYER_HEX[p.id] }} />
                      <span className="text-sm font-medium">{rp ? rp.name : "等待加入..."}</span>
                      {rp?.is_host && <span className="text-[10px] text-stone-400">房主</span>}
                      {state.currentPlayer === i && !winner && <span className="text-[10px] font-bold" style={{ color: PLAYER_HEX[p.id] }}>回合中</span>}
                    </div>
                    <span className="text-xs text-stone-600 tabular-nums">{steps === RING_LENGTH ? "🏁" : `${steps}/${RING_LENGTH}`}</span>
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
            {myPlayerIdx === 0 && roomPlayers.length >= 2 && roomPlayers.every((p: PlayerRecord) => p.is_ready || p.is_host) && (
              <button onClick={handleStartGame} className="w-full py-3 bg-stone-900 text-white rounded-xl font-semibold">开始游戏</button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
