import { supabase } from './supabase';
import { generateRoomCode, normalizeRoomCode } from '@/utils/validation';
import type {
  ActionPayload,
  ActionResult,
  LeaderboardEntry,
  Room,
  RoomPlayer,
} from '@/types/game';

const MAX_CODE_RETRIES = 5;

export async function createRoom(
  hostName: string,
): Promise<{ room: Room; player: RoomPlayer }> {
  const playerId = crypto.randomUUID();

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const code = generateRoomCode();
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        code,
        status: 'waiting',
        phase: 'waiting',
        host_player_id: playerId,
        game_state: {},
        version: 0,
      })
      .select('*')
      .single();

    if (error) {
      // 23505 = unique violation on `code`; retry with a new code.
      if ((error as { code?: string }).code === '23505') {
        lastErr = error;
        continue;
      }
      throw error;
    }

    const { data: player, error: pErr } = await supabase
      .from('room_players')
      .insert({
        id: playerId,
        room_id: (room as Room).id,
        name: hostName.trim(),
        is_host: true,
        is_alive: true,
        connected: true,
        order_index: 0,
      })
      .select('*')
      .single();

    if (pErr) {
      await supabase.from('rooms').delete().eq('id', (room as Room).id);
      throw pErr;
    }

    return { room: room as Room, player: player as RoomPlayer };
  }

  throw lastErr ?? new Error('Failed to allocate a unique room code');
}

export async function joinRoom(
  code: string,
  playerName: string,
): Promise<{ room: Room; player: RoomPlayer }> {
  const normalized = normalizeRoomCode(code);

  const { data: room, error: rErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', normalized)
    .single();

  if (rErr || !room) throw new Error('Room not found');
  if ((room as Room).status !== 'waiting') {
    throw new Error('Game already in progress');
  }

  const playerId = crypto.randomUUID();
  const { data: player, error: pErr } = await supabase
    .from('room_players')
    .insert({
      id: playerId,
      room_id: (room as Room).id,
      name: playerName.trim(),
      is_host: false,
      is_alive: true,
      connected: true,
    })
    .select('*')
    .single();

  if (pErr) {
    if ((pErr as { code?: string }).code === '23505') {
      throw new Error('Name already taken in this room');
    }
    throw pErr;
  }

  return { room: room as Room, player: player as RoomPlayer };
}

export async function executeAction(
  roomId: string,
  playerId: string,
  action: ActionPayload,
  version: number,
): Promise<ActionResult> {
  const { data, error } = await supabase.rpc('handle_action', {
    p_room_id: roomId,
    p_player_id: playerId,
    p_action: action as unknown as Record<string, unknown>,
    p_expected_version: version,
  });

  if (error) return { success: false, error: error.message };

  const result = (data ?? {}) as { success?: boolean; error?: string; message?: string };
  if (result.error) return { success: false, error: result.error };
  return { success: true, message: result.message };
}

export async function getRoom(roomId: string): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();
  if (error || !data) throw error ?? new Error('Room not found');
  return data as Room;
}

export async function getPlayers(roomId: string): Promise<RoomPlayer[]> {
  const { data, error } = await supabase
    .from('room_players')
    .select('*')
    .eq('room_id', roomId)
    .order('order_index', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as RoomPlayer[];
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_wins', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as LeaderboardEntry[];
}
