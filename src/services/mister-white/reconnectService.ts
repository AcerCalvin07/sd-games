import { getSupabaseClient } from '@/lib/supabase/client';
import type { LocalSession, Room, RoomPlayer, GamePhase } from '@/lib/supabase/types';

const supabase = getSupabaseClient();

export const SESSION_KEY = 'mw_session';

export function saveSession(session: LocalSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): LocalSession | null {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as LocalSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export interface ReconnectResult {
  session: LocalSession;
  room: Room;
  players: RoomPlayer[];
  phase: GamePhase | null;
  isAlive: boolean;
}

export async function attemptReconnect(session: LocalSession): Promise<ReconnectResult | null> {
  const { data, error } = await supabase.rpc('player_reconnect', {
    p_room_code: session.room_code,
    p_player_name: session.player_name,
  });

  if (error || !data) {
    clearSession();
    return null;
  }

  if (data.status === 'finished' && data.phase !== 'game_over') {
    clearSession();
    return null;
  }

  const { data: players } = await supabase
    .from('room_players')
    .select('*')
    .eq('room_id', data.room_id)
    .order('joined_at', { ascending: true });

  const updatedSession: LocalSession = {
    ...session,
    room_id: data.room_id,
    player_id: data.player_id,
    is_host: data.is_host,
  };

  saveSession(updatedSession);

  return {
    session: updatedSession,
    room: {
      id: data.room_id,
      code: data.code,
      status: data.status,
      phase: data.phase,
      host_player_id: data.host_player_id,
      current_turn_player_id: data.current_turn_player_id,
      game_state: data.game_state ?? {},
      settings: data.settings,
      version: data.version,
      created_at: data.created_at,
      updated_at: data.updated_at,
    } as Room,
    players: (players ?? []) as RoomPlayer[],
    phase: data.phase,
    isAlive: data.is_alive,
  };
}

export async function notifyDisconnect(playerId: string): Promise<void> {
  await supabase.rpc('player_disconnect', { p_player_id: playerId });
}
