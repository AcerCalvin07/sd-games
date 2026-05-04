'use client';

import { useEffect, useMemo, useState } from 'react';
import { getPlayers } from '@/services/gameService';
import { subscribeToPlayers, unsubscribe } from '@/services/realtimeService';
import type { RoomPlayer } from '@/types/game';

export function useRoomPlayers(roomId: string | null) {
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getPlayers(roomId)
      .then((rows) => {
        if (!cancelled) setPlayers(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const channel = subscribeToPlayers(roomId, (payload) => {
      setPlayers((prev) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as Partial<RoomPlayer>;
          return prev.filter((p) => p.id !== old.id);
        }
        const next = payload.new as RoomPlayer | undefined;
        if (!next) return prev;
        const idx = prev.findIndex((p) => p.id === next.id);
        if (idx === -1) return [...prev, next].sort(byOrder);
        const copy = prev.slice();
        copy[idx] = next;
        return copy.sort(byOrder);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe(channel);
    };
  }, [roomId]);

  return { players, loading };
}

export function useCurrentPlayer(players: RoomPlayer[], playerId: string | null): RoomPlayer | null {
  return useMemo(
    () => (playerId ? players.find((p) => p.id === playerId) ?? null : null),
    [players, playerId],
  );
}

function byOrder(a: RoomPlayer, b: RoomPlayer): number {
  const ai = a.order_index ?? Number.MAX_SAFE_INTEGER;
  const bi = b.order_index ?? Number.MAX_SAFE_INTEGER;
  if (ai !== bi) return ai - bi;
  return a.name.localeCompare(b.name);
}
