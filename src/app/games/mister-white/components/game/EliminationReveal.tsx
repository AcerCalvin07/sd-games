'use client';

import { useState } from 'react';
import type { Room, LocalSession, EliminatedPlayer } from '@/lib/supabase/types';
import { nextRound } from '@/services/mister-white/gameService';

interface Props {
  room: Room;
  localSession: LocalSession;
}

export default function EliminationReveal({ room, localSession }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eliminated: EliminatedPlayer[] = room.game_state.eliminated_this_round ?? [];
  const isHost = localSession.is_host;

  async function handleContinue() {
    if (busy || !isHost) return;
    setBusy(true);
    setError(null);
    try {
      await nextRound({
        roomId: room.id,
        playerId: localSession.player_id,
        version: room.version,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to advance');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex flex-col px-6 py-10 max-w-md mx-auto">
      <header className="text-center mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Eliminated</p>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center gap-6">
        {eliminated.length === 0 && (
          <p className="text-neutral-500 text-sm">No one was eliminated.</p>
        )}
        {eliminated.map((p) => {
          const isMrWhite = p.role === 'mr_white';
          return (
            <div
              key={p.id}
              className={`w-full rounded-2xl p-6 text-center border-2 ${
                isMrWhite
                  ? 'bg-red-600/10 border-red-500'
                  : 'bg-neutral-900 border-neutral-800'
              }`}
            >
              <p className="text-3xl font-black text-white tracking-tight mb-2">{p.name}</p>
              <p
                className={`text-sm font-semibold uppercase tracking-widest ${
                  isMrWhite ? 'text-red-400' : 'text-neutral-400'
                }`}
              >
                was {isMrWhite ? 'MR. WHITE' : 'a CIVILIAN'}
              </p>
              {!isMrWhite && p.word && (
                <p className="mt-3 text-neutral-300 text-sm">
                  Their word: <span className="text-white font-semibold">{p.word}</span>
                </p>
              )}
            </div>
          );
        })}
      </section>

      {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

      <div className="pt-6">
        {isHost ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleContinue}
            className="w-full min-h-[56px] rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold text-lg tracking-wider transition"
          >
            {busy ? 'Loading...' : 'CONTINUE'}
          </button>
        ) : (
          <p className="text-center text-sm text-neutral-400">Waiting for host to continue...</p>
        )}
      </div>
    </main>
  );
}
