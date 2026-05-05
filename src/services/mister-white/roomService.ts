import { getSupabaseClient } from '@/lib/supabase/client';
import type { RoomSettings, LocalSession, RoomPlayer, GameState, GamePhase } from '@/lib/supabase/types';

const supabase = getSupabaseClient();

export async function createRoom(
  hostName: string,
  settings: Partial<RoomSettings>,
): Promise<LocalSession> {
  const { data, error } = await supabase.rpc('create_room', {
    p_host_name: hostName,
    p_settings: settings as RoomSettings,
  });
  if (error) throw new Error(error.message);

  return {
    room_id: data.room_id,
    player_id: data.player_id,
    player_name: hostName,
    room_code: data.code,
    is_host: true,
  };
}

export async function joinRoom(
  code: string,
  playerName: string,
): Promise<LocalSession & { phase: GamePhase | null; game_state: GameState; settings: RoomSettings }> {
  const { data, error } = await supabase.rpc('join_room', {
    p_code: code.toUpperCase(),
    p_player_name: playerName,
  });
  if (error) throw new Error(error.message);

  return {
    room_id: data.room_id,
    player_id: data.player_id,
    player_name: playerName,
    room_code: data.code,
    is_host: false,
    phase: data.phase,
    game_state: data.game_state,
    settings: data.settings,
  };
}

export async function updateRoomSettings(
  roomId: string,
  playerId: string,
  settings: Partial<RoomSettings>,
): Promise<void> {
  const { error } = await supabase.rpc('update_room_settings', {
    p_room_id: roomId,
    p_player_id: playerId,
    p_settings: settings,
  });
  if (error) throw new Error(error.message);
}

export async function getRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
  const { data, error } = await supabase
    .from('room_players')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RoomPlayer[];
}

export async function playAgain(roomId: string, playerId: string): Promise<void> {
  const { error } = await supabase.rpc('play_again', {
    p_room_id: roomId,
    p_player_id: playerId,
  });
  if (error) throw new Error(error.message);
}
