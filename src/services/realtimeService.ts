import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Room, RoomPlayer } from '@/types/game';

export function subscribeToRoom(
  roomId: string,
  callback: (payload: RealtimePostgresChangesPayload<Room>) => void,
): RealtimeChannel {
  return supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      callback as (p: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
    )
    .subscribe();
}

export function subscribeToPlayers(
  roomId: string,
  callback: (payload: RealtimePostgresChangesPayload<RoomPlayer>) => void,
): RealtimeChannel {
  return supabase
    .channel(`players:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
      callback as (p: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
    )
    .subscribe();
}

export function unsubscribe(channel: RealtimeChannel): void {
  void supabase.removeChannel(channel);
}
