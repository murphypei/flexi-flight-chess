import { supabase } from "@/lib/supabase";
import { buildCells, FLY_STEPS, RETREAT_STEPS, Cell } from "@/lib/board";

// ============================================================
// Types
// ============================================================

export interface BoardRecord {
  id: string;
  name: string;
  description: string;
  player_count: number;
  board_size: number;
  cells: Cell[];
  rules: {
    flySteps?: number;
    retreatSteps?: number;
    safeCells?: number[];
    flyCells?: number[];
    retreatCells?: number[];
    description?: string;
  };
  is_template: boolean;
  created_at?: string;
}

export interface RoomRecord {
  id: string;
  code: string;
  board_id: string;
  host_id: string;
  player_count: number;
  max_players: number;
  game_state: any;
  status: string;
}

export interface PlayerRecord {
  id: string;
  room_id: string;
  name: string;
  color: string;
  player_index: number;
  is_host: boolean;
  is_ready: boolean;
}

// ============================================================
// Board templates
// ============================================================

const TEMPLATES: BoardRecord[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "经典双人棋盘",
    description: "9×9 回字形，2人对战",
    player_count: 2,
    board_size: 9,
    cells: buildCells({}, undefined, 2),
    rules: { flySteps: FLY_STEPS, retreatSteps: RETREAT_STEPS, description: "标准规则：飞行+3，回退-2" },
    is_template: true,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "经典四人棋盘",
    description: "9×9 回字形，4人对战",
    player_count: 4,
    board_size: 9,
    cells: buildCells({}, undefined, 4),
    rules: { flySteps: FLY_STEPS, retreatSteps: RETREAT_STEPS, description: "标准规则：飞行+3，回退-2" },
    is_template: true,
  },
];

export async function seedTemplates() {
  for (const t of TEMPLATES) {
    await supabase.from("boards").upsert(t, { onConflict: "id" });
  }
}

// ============================================================
// Boards CRUD
// ============================================================

export async function getTemplates(playerCount?: number) {
  let q = supabase.from("boards").select("*").eq("is_template", true).order("name");
  if (playerCount) q = q.eq("player_count", playerCount);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as BoardRecord[];
}

export async function getBoard(id: string): Promise<BoardRecord | null> {
  const { data, error } = await supabase.from("boards").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as BoardRecord;
}

export async function getMyBoards(): Promise<BoardRecord[]> {
  const { data } = await supabase.from("boards").select("*").eq("is_template", false).order("created_at", { ascending: false });
  return (data || []) as BoardRecord[];
}

export async function createBoard(board: Omit<BoardRecord, "id" | "created_at">): Promise<BoardRecord> {
  const { data, error } = await supabase.from("boards").insert(board).select().single();
  if (error) throw error;
  return data as BoardRecord;
}

export async function updateBoard(id: string, updates: Partial<BoardRecord>) {
  const { error } = await supabase.from("boards").update(updates).eq("id", id);
  if (error) throw error;
}

// ============================================================
// Rooms CRUD
// ============================================================

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export async function createRoom(boardId: string, hostId: string, hostName: string, maxPlayers: number) {
  const code = genCode();
  const { data: room, error } = await supabase.from("rooms").insert({
    code, board_id: boardId, host_id: hostId,
    max_players: maxPlayers, player_count: maxPlayers,
    game_state: { phase: "waiting" },
    status: "waiting",
  }).select().single();
  if (error) throw error;

  // Create host player
  const colors = ["red", "blue", "green", "yellow"];
  const { data: player } = await supabase.from("players").insert({
    room_id: room.id, name: hostName, color: colors[0],
    player_index: 0, is_host: true, is_ready: false,
  }).select().single();

  return { room, playerId: player?.id, code };
}

export async function getRoomByCode(code: string) {
  const { data, error } = await supabase.from("rooms").select("*").eq("code", code.toUpperCase()).single();
  if (error || !data) return null;
  return data as RoomRecord;
}

export async function joinRoom(roomId: string, name: string) {
  // Count existing players
  const { data: existing } = await supabase.from("players").select("*").eq("room_id", roomId).order("player_index");
  const count = existing?.length || 0;

  const colors = ["red", "blue", "green", "yellow"];
  const used = (existing || []).map((p: any) => p.color);
  const color = colors.find((c) => !used.includes(c)) || colors[count % 4];

  const { data, error } = await supabase.from("players").insert({
    room_id: roomId, name, color,
    player_index: count, is_host: false, is_ready: false,
  }).select().single();
  if (error) throw error;
  return data as PlayerRecord;
}

export async function getRoomPlayers(roomId: string): Promise<PlayerRecord[]> {
  const { data } = await supabase.from("players").select("*").eq("room_id", roomId).order("player_index");
  return (data || []) as PlayerRecord[];
}

export async function updatePlayer(roomId: string, playerIndex: number, updates: Partial<PlayerRecord>) {
  await supabase.from("players").update(updates).eq("room_id", roomId).eq("player_index", playerIndex);
}

export async function updateRoom(roomId: string, updates: Partial<RoomRecord>) {
  await supabase.from("rooms").update(updates).eq("id", roomId);
}

// ============================================================
// Realtime subscriptions
// ============================================================

export function subscribeRoom(roomId: string, cb: (payload: any) => void) {
  return supabase
    .channel(`room:${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, cb)
    .subscribe();
}

export function subscribePlayers(roomId: string, cb: (payload: any) => void) {
  return supabase
    .channel(`players:${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` }, cb)
    .subscribe();
}
