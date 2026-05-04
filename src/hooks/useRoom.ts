'use client';

import { useEffect, useState } from 'react';
import { getRoom } from '@/services/gameService';
import { subscribeToRoom, unsubscribe } from '@/services/realtimeService';
import type { Room } from '@/types/game';

export function useRoom(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getRoom(roomId)
      .then((r) => {
        if (!cancelled) setRoom(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const channel = subscribeToRoom(roomId, (payload) => {
      if (payload.eventType === 'DELETE') {
        setRoom(null);
        return;
      }
      const next = payload.new as Room | undefined;
      if (next) setRoom(next);
    });

    return () => {
      cancelled = true;
      unsubscribe(channel);
    };
  }, [roomId]);

  return { room, loading, error };
}
