'use client';

import { useState } from 'react';
import type { Room, RoomPlayer, LocalSession, RoomSettings } from '@/lib/supabase/types';
import { updateRoomSettings } from '@/services/mister-white/roomService';
import { startGame } from '@/services/mister-white/gameService';
import { clearSession } from '@/services/mister-white/reconnectService';

interface Props {
  room: Room;
  players: RoomPlayer[];
  localSession: LocalSession;
  onGameStarted: () => void;
  onExit: () => void;
}

const HINT_TIMER_OPTIONS = [15, 30, 45, 60];
const VOTE_TIMER_OPTIONS = [30, 60, 90, 120];
const MIN_PLAYER_OPTIONS = [5, 6, 7, 8];
const MAX_PLAYER_OPTIONS = [8, 10, 12, 15, 20];
const ROUND_OPTIONS = [1, 2, 3];
const ELIMINATION_OPTIONS = [1, 2];

export default function LobbyScreen({ room, players, localSession, onGameStarted, onExit }: Props) {
  void onGameStarted;
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSettings, setPendingSettings] = useState<Partial<RoomSettings>>({});

  const isHost = localSession.is_host;
  const isReconfiguring = room.status === 'reconfiguring';
  const settings: RoomSettings = { ...room.settings, ...pendingSettings };
  const playerCount = players.length;
  const minPlayers = settings.min_players;
  const maxPlayers = settings.max_players;
  const canStart = playerCount >= minPlayers;
  const host = players.find((p) => p.id === room.host_player_id);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }

  async function handleSettingChange<K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) {
    if (!isHost) return;
    setPendingSettings((p) => ({ ...p, [key]: value }));
    try {
      await updateRoomSettings(room.id, localSession.player_id, { [key]: value });
      setPendingSettings((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    } catch (e) {
      setPendingSettings((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
      setError(e instanceof Error ? e.message : 'Failed to update settings');
    }
  }

  async function handleStart() {
    if (!isHost || !canStart || starting) return;
    setStarting(true);
    setError(null);
    try {
      await startGame({ roomId: room.id, playerId: localSession.player_id, version: room.version });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start game');
      setStarting(false);
    }
  }

  function handleLeave() {
    clearSession();
    onExit();
  }

  return (
    <main className="min-h-screen w-full flex flex-col px-6 py-6 max-w-md mx-auto">
      <section className="text-center mb-6">
        <p className="text-xs uppercase tracking-widest text-neutral-500">Room Code</p>
        <button
          type="button"
          onClick={copyCode}
          className="mt-1 text-5xl font-black tracking-[0.4em] text-white hover:text-red-400 transition"
        >
          {room.code}
        </button>
        <p className="text-xs text-neutral-500 mt-1 h-4">{copied ? 'Copied!' : 'Tap to copy'}</p>
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-neutral-300">Players</h2>
          <span className="text-xs text-neutral-500">
            {playerCount} / {maxPlayers}
          </span>
        </div>
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    p.connected ? 'bg-green-500' : 'bg-neutral-600'
                  }`}
                />
                <span className="text-white truncate">{p.name}</span>
                {p.id === localSession.player_id && (
                  <span className="text-[10px] text-neutral-500">(you)</span>
                )}
              </div>
              {p.is_host && (
                <span className="text-[10px] font-semibold tracking-wider text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-0.5">
                  HOST
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-neutral-300 mb-2">Settings</h2>
        <div className="grid grid-cols-2 gap-2">
          <SettingRow
            label="Hint Timer"
            value={settings.hint_timer}
            options={HINT_TIMER_OPTIONS.map((v) => ({ value: v, label: `${v}s` }))}
            editable={isHost}
            onChange={(v) => handleSettingChange('hint_timer', v)}
          />
          <SettingRow
            label="Vote Timer"
            value={settings.vote_timer}
            options={VOTE_TIMER_OPTIONS.map((v) => ({ value: v, label: `${v}s` }))}
            editable={isHost}
            onChange={(v) => handleSettingChange('vote_timer', v)}
          />
          <SettingRow
            label="Min Players"
            value={settings.min_players}
            options={MIN_PLAYER_OPTIONS.map((v) => ({ value: v, label: `${v}` }))}
            editable={isHost}
            onChange={(v) => handleSettingChange('min_players', v)}
          />
          <SettingRow
            label="Max Players"
            value={settings.max_players}
            options={MAX_PLAYER_OPTIONS.map((v) => ({ value: v, label: `${v}` }))}
            editable={isHost}
            onChange={(v) => handleSettingChange('max_players', v)}
          />
          <SettingRow
            label="Rounds / Vote"
            value={settings.rounds_before_voting}
            options={ROUND_OPTIONS.map((v) => ({ value: v, label: `${v}` }))}
            editable={isHost}
            onChange={(v) => handleSettingChange('rounds_before_voting', v)}
          />
          <SettingRow
            label="Eliminations"
            value={settings.eliminations_per_vote}
            options={ELIMINATION_OPTIONS.map((v) => ({ value: v, label: `${v}` }))}
            editable={isHost}
            onChange={(v) => handleSettingChange('eliminations_per_vote', v)}
          />
        </div>
      </section>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <div className="mt-auto flex flex-col gap-3">
        {isHost ? (
          <>
            <button
              type="button"
              disabled={!canStart || starting}
              onClick={handleStart}
              className="w-full min-h-[52px] rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-semibold transition"
            >
              {starting ? 'Starting...' : 'Start Game'}
            </button>
            {!canStart && (
              <p className="text-center text-xs text-neutral-500">
                Need at least {minPlayers} players to start ({playerCount}/{minPlayers})
              </p>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-neutral-400">
            {isReconfiguring
              ? `${host?.name ?? 'Host'} is configuring the next round...`
              : `Waiting for ${host?.name ?? 'host'} to start...`}
          </p>
        )}

        <button
          type="button"
          onClick={handleLeave}
          className="w-full min-h-[44px] rounded-xl bg-transparent border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white text-sm transition"
        >
          Leave
        </button>
      </div>
    </main>
  );
}

function SettingRow<T extends number>({
  label,
  value,
  options,
  editable,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  editable: boolean;
  onChange: (v: T) => void;
}) {
  const display = options.find((o) => o.value === value)?.label ?? String(value);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      {editable ? (
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value) as T)}
          className="w-full bg-transparent text-white text-sm font-medium focus:outline-none mt-0.5"
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={opt.value} className="bg-neutral-900">
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-white text-sm font-medium mt-0.5">{display}</p>
      )}
    </div>
  );
}
