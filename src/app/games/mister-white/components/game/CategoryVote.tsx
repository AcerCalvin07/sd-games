'use client';

import { useEffect, useRef, useState } from 'react';
import type { Room, LocalSession } from '@/lib/supabase/types';
import { voteCategory, resolveCategoryVote } from '@/services/mister-white/gameService';
import { useCountdown, timerColorClass } from '@/hooks/mister-white/useCountdown';

interface Props {
  room: Room;
  localSession: LocalSession;
}

const CATEGORY_VOTE_DURATION = 10;

export default function CategoryVote({ room, localSession }: Props) {
  const [busyCategory, setBusyCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options: string[] = room.game_state.category_options ?? [];
  const votes = room.game_state.category_votes ?? [];
  const myVote = votes.find((v) => v.player_id === localSession.player_id)?.category ?? null;
  const totalPlayers = room.game_state.players?.length ?? 0;
  const voteCount = votes.length;

  // Server-stamped timestamp from handle_player_ready RPC.
  // If missing for any reason, useCountdown returns the full duration frozen
  // until the realtime update arrives — better than drifting per-client.
  const startedAt =
    (room.game_state as { category_vote_started_at?: number }).category_vote_started_at ?? null;
  const remaining = useCountdown(startedAt, CATEGORY_VOTE_DURATION);

  const resolveFiredRef = useRef(false);
  useEffect(() => {
    if (remaining > 0 || resolveFiredRef.current) return;
    if (!localSession.is_host) return;
    if (startedAt == null) return; // Don't fire before server timestamp is known
    resolveFiredRef.current = true;
    resolveCategoryVote({
      roomId: room.id,
      playerId: localSession.player_id,
      version: room.version,
    }).catch(() => {
      resolveFiredRef.current = false;
    });
  }, [remaining, startedAt, localSession.is_host, localSession.player_id, room.id, room.version]);

  async function handleVote(category: string) {
    if (busyCategory) return;
    setBusyCategory(category);
    setError(null);
    try {
      await voteCategory(
        { roomId: room.id, playerId: localSession.player_id, version: room.version },
        category,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to vote');
    } finally {
      setBusyCategory(null);
    }
  }

  return (
    <main className="min-h-screen w-full flex flex-col px-6 py-6 max-w-md mx-auto">
      <header className="text-center mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight">CHOOSE A CATEGORY</h1>
        <p className="text-neutral-500 text-sm mt-1">Vote for the category you want to play</p>
      </header>

      <div className="text-center mb-4">
        <span
          className={`text-5xl font-black tabular-nums ${timerColorClass(remaining, CATEGORY_VOTE_DURATION)}`}
        >
          {remaining}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1 content-start">
        {options.map((cat) => {
          const count = votes.filter((v) => v.category === cat).length;
          const isMine = myVote === cat;
          const isBusy = busyCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              disabled={isBusy}
              onClick={() => handleVote(cat)}
              className={`aspect-square rounded-2xl p-4 flex flex-col items-center justify-center text-center transition ${
                isMine
                  ? 'bg-red-600/20 border-2 border-red-500'
                  : 'bg-neutral-900 border-2 border-neutral-800 hover:border-neutral-600'
              }`}
            >
              <span className="text-lg font-bold text-white">{cat}</span>
              <span className="text-xs text-neutral-400 mt-2">
                {count} vote{count === 1 ? '' : 's'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pt-4 text-center">
        <p className="text-xs text-neutral-500">
          {voteCount} / {totalPlayers} voted
        </p>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    </main>
  );
}