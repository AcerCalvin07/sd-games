'use client';

import { useState } from 'react';
import type { Room, LocalSession } from '@/lib/supabase/types';
import { playerReady } from '@/services/mister-white/gameService';

interface Props {
  room: Room;
  localSession: LocalSession;
}

export default function TutorialModal({ room, localSession }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyPlayers = room.game_state.ready_players ?? [];
  const totalPlayers = room.game_state.players?.length ?? 0;
  const amReady = readyPlayers.includes(localSession.player_id);
  const rounds = room.settings.rounds_before_voting;

  async function handleReady() {
    if (busy || amReady) return;
    setBusy(true);
    setError(null);
    try {
      await playerReady({
        roomId: room.id,
        playerId: localSession.player_id,
        version: room.version,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to ready up');
      setBusy(false);
    }
  }

  return (
    <main className="fixed inset-0 bg-neutral-950 flex flex-col px-6 py-10 max-w-md mx-auto">
      <h1 className="text-3xl font-black tracking-tight text-white text-center mb-8">HOW TO PLAY</h1>

      <ul className="flex-1 space-y-4 text-neutral-200">
        <Rule>
          One player is <span className="text-red-400 font-semibold">Mr. White</span> — they have no
          word.
        </Rule>
        <Rule>
          Everyone else is a <span className="text-white font-semibold">Civilian</span> — they share
          a secret word.
        </Rule>
        <Rule>Take turns giving one-word hints about your word.</Rule>
        <Rule>
          After {rounds} hint round{rounds === 1 ? '' : 's'}, vote to eliminate a player.
        </Rule>
        <Rule>Civilians win if Mr. White is eliminated.</Rule>
        <Rule>Mr. White wins if civilians are outnumbered.</Rule>
      </ul>

      {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

      <div className="pt-6">
        <p className="text-center text-xs text-neutral-500 mb-3">
          {readyPlayers.length} / {totalPlayers} players ready
        </p>
        <button
          type="button"
          disabled={amReady || busy}
          onClick={handleReady}
          className="w-full min-h-[56px] rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold text-lg tracking-wider transition"
        >
          {amReady ? 'Waiting for others...' : busy ? 'Loading...' : 'READY'}
        </button>
      </div>
    </main>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 items-start text-base leading-relaxed">
      <span className="text-red-500 mt-1 shrink-0">●</span>
      <span>{children}</span>
    </li>
  );
}
