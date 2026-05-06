'use client';

import { useState } from 'react';
import type { Room, LocalSession, GamePlayer } from '@/lib/supabase/types';
import { playerGotIt } from '@/services/mister-white/gameService';

interface Props {
  room: Room;
  localSession: LocalSession;
  myPlayer: GamePlayer | null;
}

export default function RoleRevealModal({ room, localSession, myPlayer }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ackPlayers = room.game_state.acknowledged_players ?? [];
  const totalPlayers = room.game_state.players?.length ?? 0;
  const amAcked = ackPlayers.includes(localSession.player_id);
  const category = room.game_state.category;
  const isMrWhite = myPlayer?.role === 'mr_white';

  async function handleGotIt() {
    if (busy || amAcked) return;
    setBusy(true);
    setError(null);
    try {
      await playerGotIt({
        roomId: room.id,
        playerId: localSession.player_id,
        version: room.version,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to acknowledge');
      setBusy(false);
    }
  }

  if (!myPlayer) {
    return (
      <main className="fixed inset-0 bg-neutral-950 flex items-center justify-center">
        <p className="text-neutral-500 text-sm">Loading role...</p>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 bg-neutral-950 flex flex-col px-6 py-10 max-w-md mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 mb-2">Category</p>
        <p className="text-xl font-semibold text-white mb-12">{category}</p>

        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 mb-3">You are</p>
        {isMrWhite ? (
          <h1 className="text-4xl font-black text-red-500 tracking-tight mb-10">MR. WHITE</h1>
        ) : (
          <h1 className="text-4xl font-black text-white tracking-tight mb-10">CIVILIAN</h1>
        )}

        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 mb-2">Your word</p>
        {isMrWhite ? (
          <div className="text-7xl font-black text-neutral-700 mb-8">???</div>
        ) : (
          <div className="text-5xl font-black text-white mb-8">{myPlayer.word}</div>
        )}

        <p className="text-sm text-neutral-400 max-w-xs">
          {isMrWhite
            ? 'You have no word. Listen carefully and blend in!'
            : "Give hints that only civilians would know. Don't be too obvious!"}
        </p>
      </div>

      {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

      <div className="pt-6">
        <p className="text-center text-xs text-neutral-500 mb-3">
          {ackPlayers.length} / {totalPlayers} ready
        </p>
        <button
          type="button"
          disabled={amAcked || busy}
          onClick={handleGotIt}
          className="w-full min-h-[56px] rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold text-lg tracking-wider transition"
        >
          {amAcked ? 'Waiting for others...' : busy ? 'Loading...' : 'GOT IT'}
        </button>
      </div>
    </main>
  );
}
