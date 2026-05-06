'use client';

import { useState } from 'react';
import type { LocalSession, Room, RoomPlayer, RoomSettings } from '@/lib/supabase/types';
import { createRoom, getRoomById, getRoomPlayers } from '@/services/mister-white/roomService';

interface Props {
  initialName?: string;
  onBack: () => void;
  onCreated: (session: LocalSession, room: Room, players: RoomPlayer[]) => void;
}

const HINT_TIMER_OPTIONS = [15, 30, 45, 60];
const VOTE_TIMER_OPTIONS = [30, 60, 90, 120];
const MIN_PLAYER_OPTIONS = [5, 6, 7, 8];
const MAX_PLAYER_OPTIONS = [8, 10, 12, 15, 20];
const ROUND_OPTIONS = [1, 2, 3];
const ELIMINATION_OPTIONS = [1, 2];

export default function HostSetupScreen({ initialName = '', onBack, onCreated }: Props) {
  const [name, setName] = useState(initialName);
  const [settings, setSettings] = useState<RoomSettings>({
    hint_timer: 30,
    vote_timer: 60,
    min_players: 5,
    max_players: 20,
    rounds_before_voting: 1,
    eliminations_per_vote: 1,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const minExceedsMax = settings.min_players > settings.max_players;
  const canSubmit = trimmedName.length > 0 && !minExceedsMax && !busy;

  const update = <K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  async function handleCreate() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const session = await createRoom(trimmedName, settings);
      const [room, players] = await Promise.all([
        getRoomById(session.room_id),
        getRoomPlayers(session.room_id),
      ]);
      onCreated(session, room as Room, players);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room');
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
        <h1 className="text-lg font-semibold text-white">Room Settings</h1>
        <span className="w-12" />
      </header>

      <div className="flex-1 max-w-md mx-auto w-full flex flex-col gap-5">
        <Field label="Your name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 32))}
            placeholder="Your name"
            maxLength={32}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-red-500"
          />
        </Field>

        <SelectField
          label="Hint Timer"
          value={settings.hint_timer}
          options={HINT_TIMER_OPTIONS.map((v) => ({ value: v, label: `${v}s` }))}
          onChange={(v) => update('hint_timer', v)}
        />
        <SelectField
          label="Voting Timer"
          value={settings.vote_timer}
          options={VOTE_TIMER_OPTIONS.map((v) => ({ value: v, label: `${v}s` }))}
          onChange={(v) => update('vote_timer', v)}
        />
        <SelectField
          label="Min Players"
          value={settings.min_players}
          options={MIN_PLAYER_OPTIONS.map((v) => ({ value: v, label: `${v}` }))}
          onChange={(v) => update('min_players', v)}
        />
        <SelectField
          label="Max Players"
          value={settings.max_players}
          options={MAX_PLAYER_OPTIONS.map((v) => ({ value: v, label: `${v}` }))}
          onChange={(v) => update('max_players', v)}
        />
        <SelectField
          label="Rounds Before Voting"
          value={settings.rounds_before_voting}
          options={ROUND_OPTIONS.map((v) => ({ value: v, label: `${v}` }))}
          onChange={(v) => update('rounds_before_voting', v)}
        />
        <SelectField
          label="Eliminations Per Vote"
          value={settings.eliminations_per_vote}
          options={ELIMINATION_OPTIONS.map((v) => ({ value: v, label: `${v}` }))}
          onChange={(v) => update('eliminations_per_vote', v)}
        />

        {minExceedsMax && (
          <p className="text-red-500 text-sm">Min players cannot exceed max players.</p>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      <div className="max-w-md mx-auto w-full pt-6">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleCreate}
          className="w-full min-h-[52px] rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-semibold transition"
        >
          {busy ? 'Creating...' : 'Create Room'}
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function SelectField<T extends number | string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value as unknown as string | number}
        onChange={(e) => {
          const raw = e.target.value;
          const next = (typeof value === 'number' ? Number(raw) : raw) as T;
          onChange(next);
        }}
        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
