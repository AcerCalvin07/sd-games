'use client';

import { useState } from 'react';
import { createRoom, executeAction, joinRoom } from '@/services/gameService';
import type { Room, RoomPlayer, RoomSettings } from '@/types/game';
import {
  DEFAULT_HINT_TIMER,
  DEFAULT_MAX_PLAYERS,
  DEFAULT_VOTE_TIMER,
  MAX_HINT_TIMER,
  MAX_PLAYERS,
  MAX_VOTE_TIMER,
  MIN_HINT_TIMER,
  MIN_PLAYERS,
  MIN_VOTE_TIMER,
} from '@/utils/constants';
import { isValidPlayerName, normalizeRoomCode } from '@/utils/validation';

interface EntryProps {
  mode: 'entry';
  onJoined: (roomId: string, playerId: string) => void;
}

interface InRoomProps {
  mode: 'in-room';
  room: Room;
  players: RoomPlayer[];
  playerId: string;
  onLeave: () => void;
}

export function LobbyScreen(props: EntryProps | InRoomProps) {
  if (props.mode === 'entry') return <EntryForm onJoined={props.onJoined} />;
  return (
    <InRoom
      room={props.room}
      players={props.players}
      playerId={props.playerId}
      onLeave={props.onLeave}
    />
  );
}

function EntryForm({ onJoined }: { onJoined: (roomId: string, playerId: string) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<null | 'create' | 'join'>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RoomSettings>({
    maxPlayers: DEFAULT_MAX_PLAYERS,
    hintTimerSeconds: DEFAULT_HINT_TIMER,
    voteTimerSeconds: DEFAULT_VOTE_TIMER,
  });

  const submit = async (action: 'create' | 'join') => {
    setError(null);
    if (!isValidPlayerName(name)) {
      setError('Name must be 1–20 letters, numbers, or spaces.');
      return;
    }
    if (action === 'join' && normalizeRoomCode(code).length !== 6) {
      setError('Room code must be 6 characters.');
      return;
    }
    setBusy(action);
    try {
      const result =
        action === 'create' ? await createRoom(name, settings) : await joinRoom(code, name);
      onJoined(result.room.id, result.player.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold">Mister White</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Create a room or join with a code.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="e.g. Ace"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Room code (to join)</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="ABCDEF"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-mono uppercase tracking-widest outline-none focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <legend className="px-1 text-xs uppercase text-zinc-500">
          Room settings (when creating)
        </legend>

        <SettingRow
          label="Max players"
          value={settings.maxPlayers}
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          step={1}
          unit=""
          onChange={(v) => setSettings((s) => ({ ...s, maxPlayers: v }))}
        />
        <SettingRow
          label="Hint timer (per turn)"
          value={settings.hintTimerSeconds}
          min={MIN_HINT_TIMER}
          max={MAX_HINT_TIMER}
          step={5}
          unit="s"
          onChange={(v) => setSettings((s) => ({ ...s, hintTimerSeconds: v }))}
        />
        <SettingRow
          label="Voting timer"
          value={settings.voteTimerSeconds}
          min={MIN_VOTE_TIMER}
          max={MAX_VOTE_TIMER}
          step={30}
          unit="s"
          onChange={(v) => setSettings((s) => ({ ...s, voteTimerSeconds: v }))}
        />
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          disabled={busy !== null}
          onClick={() => submit('join')}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {busy === 'join' ? 'Joining…' : 'Join Room'}
        </button>
        <button
          disabled={busy !== null}
          onClick={() => submit('create')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy === 'create' ? 'Creating…' : 'Create Room'}
        </button>
      </div>
    </main>
  );
}

function SettingRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-xs text-zinc-500">
          {value}
          {unit} <span className="text-zinc-400">({min}–{max}{unit})</span>
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
    </label>
  );
}

function InRoom({
  room,
  players,
  playerId,
  onLeave,
}: {
  room: Room;
  players: RoomPlayer[];
  playerId: string;
  onLeave: () => void;
}) {
  const me = players.find((p) => p.id === playerId);
  const isHost = me?.is_host ?? false;
  const atCapacity = players.length >= room.max_players;
  const canStart = isHost && players.length >= MIN_PLAYERS;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const startGame = async () => {
    setError(null);
    setStarting(true);
    const res = await executeAction(room.id, playerId, { type: 'START_GAME' }, room.version);
    setStarting(false);
    if (!res.success) setError(res.error ?? 'Failed to start');
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Lobby</h1>
        <button
          onClick={onLeave}
          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          Leave
        </button>
      </header>

      <section className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-xs uppercase tracking-wider text-zinc-500">Room code</span>
        <button
          onClick={copyCode}
          className="font-mono text-4xl font-bold tracking-[0.4em] hover:text-blue-600"
          aria-label="Copy room code"
        >
          {room.code}
        </button>
        <span className="text-xs text-zinc-500">{copied ? 'Copied!' : 'Tap to copy'}</span>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="Max players" value={`${room.max_players}`} />
        <Stat label="Hint timer" value={`${room.hint_timer_seconds}s`} />
        <Stat label="Vote timer" value={`${room.vote_timer_seconds}s`} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          Players ({players.length}/{room.max_players})
        </h2>
        <ul className="flex flex-col gap-2">
          {players.map((p) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                p.id === playerId
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <span className="font-medium">
                {p.name}
                {p.id === playerId && <span className="ml-1 text-xs text-blue-600">(you)</span>}
              </span>
              {p.is_host && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  Host
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isHost && (
        <button
          disabled={!canStart || starting}
          onClick={startGame}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {starting
            ? 'Starting…'
            : canStart
              ? 'Start Game'
              : `Need ${MIN_PLAYERS - players.length} more player(s)`}
        </button>
      )}
      {!isHost && (
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Waiting for host to start…
        </p>
      )}
      {atCapacity && (
        <p className="text-center text-xs text-amber-700 dark:text-amber-300">
          Room is at capacity.
        </p>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
