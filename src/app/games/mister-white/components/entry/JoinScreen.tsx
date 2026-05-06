'use client';

import { useState } from 'react';
import type { LocalSession, Room, RoomPlayer } from '@/lib/supabase/types';
import { joinRoom, getRoomById, getRoomPlayers } from '@/services/mister-white/roomService';

interface Props {
  initialName?: string;
  onBack: () => void;
  onJoined: (session: LocalSession, room: Room, players: RoomPlayer[]) => void;
}

const CODE_PATTERN = /^[A-Z0-9]{0,4}$/;

export default function JoinScreen({ initialName = '', onBack, onJoined }: Props) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && code.length === 4 && !busy;

  function handleCodeChange(raw: string) {
    const next = raw.toUpperCase();
    if (!CODE_PATTERN.test(next)) return;
    setCode(next);
    if (error) setError(null);
  }

  async function handleJoin() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const result = await joinRoom(code, trimmedName);
      const session: LocalSession = {
        room_id: result.room_id,
        player_id: result.player_id,
        player_name: trimmedName,
        room_code: result.room_code,
        is_host: false,
      };
      const [room, players] = await Promise.all([
        getRoomById(session.room_id),
        getRoomPlayers(session.room_id),
      ]);
      onJoined(session, room as Room, players);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex flex-col px-6 py-6">
      <header className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={onBack}
          className="text-neutral-400 hover:text-white text-sm transition"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-white">Join Game</h1>
        <span className="w-12" />
      </header>

      <div className="flex-1 max-w-md mx-auto w-full flex flex-col gap-6">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Your name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 32))}
            placeholder="Your name"
            maxLength={32}
            className="mt-1.5 w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-red-500"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Room code
          </span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="ABCD"
            maxLength={4}
            className="mt-1.5 w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-5 text-3xl font-bold text-center tracking-[0.5em] text-white placeholder-neutral-700 focus:outline-none focus:border-red-500"
          />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </label>
      </div>

      <div className="max-w-md mx-auto w-full pt-6">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleJoin}
          className="w-full min-h-[52px] rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-semibold transition"
        >
          {busy ? 'Joining...' : 'Join'}
        </button>
      </div>
    </main>
  );
}
