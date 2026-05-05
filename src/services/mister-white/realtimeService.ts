import { getSupabaseClient } from '@/lib/supabase/client';
import type { Room, RoomPlayer } from '@/lib/supabase/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabase = getSupabaseClient();

interface RealtimeCallbacks {
  onRoomUpdate: (room: Room) => void;
  onPlayersUpdate: (players: RoomPlayer[]) => void;
}

let activeChannel: RealtimeChannel | null = null;

export function subscribeToRoom(roomId: string, callbacks: RealtimeCallbacks): () => void {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }

  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        callbacks.onRoomUpdate(payload.new as Room);
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      },
      async () => {
        const { data } = await supabase
          .from('room_players')
          .select('*')
          .eq('room_id', roomId)
          .order('joined_at', { ascending: true });
        if (data) callbacks.onPlayersUpdate(data as RoomPlayer[]);
      },
    )
    .subscribe();

  activeChannel = channel;

  return () => {
    supabase.removeChannel(channel);
    activeChannel = null;
  };
}

export function unsubscribeAll() {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
}
