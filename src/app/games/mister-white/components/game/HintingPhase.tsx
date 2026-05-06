'use client';

import { useEffect, useRef, useState } from 'react';
import type { Room, RoomPlayer, LocalSession, HintEntry, GamePlayer } from '@/lib/supabase/types';
import { submitHint, skipHint } from '@/services/mister-white/gameService';
import { useCountdown, timerColorClass } from '@/hooks/mister-white/useCountdown';

interface Props {
  room: Room;
  players: RoomPlayer[];
  localSession: LocalSession;
}

export default function HintingPhase({ room, players, localSession }: Props) {
  void players;
  const [hintInput, setHintInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gamePlayers: GamePlayer[] = room.game_state.players ?? [];
  const hints: HintEntry[] = room.game_state.hints ?? [];
  const currentHintRound = room.game_state.current_hint_round ?? 1;
  const totalHintRounds = room.settings.rounds_before_voting;
  const eliminationRound = room.game_state.round ?? 1;
  const category = room.game_state.category;
  const hintTimer = room.settings.hint_timer;
  const hintStartedAt = room.game_state.hint_turn_started_at ?? null;
  const remaining = useCountdown(hintStartedAt, hintTimer);

  const isMyTurn = room.current_turn_player_id === localSession.player_id;
  const myPlayer = gamePlayers.find((p) => p.id === localSession.player_id);
  const currentTurnPlayer = gamePlayers.find((p) => p.id === room.current_turn_player_id);

  const turnId = `${room.current_turn_player_id ?? 'none'}|${hintStartedAt ?? 0}`;
  const skipFiredRef = useRef<string | null>(null);

  useEffect(() => {
    if (remaining > 0) return;
    if (skipFiredRef.current === turnId) return;
    if (!room.current_turn_player_id) return;

    const fire = async () => {
      skipFiredRef.current = turnId;
      try {
        await skipHint({
          roomId: room.id,
          playerId: localSession.player_id,
          version: room.version,
        });
      } catch {
        // Likely a version mismatch — another client beat us. Ignore.
      }
    };

    if (isMyTurn) {
      fire();
    } else {
      const t = setTimeout(fire, 2000);
      return () => clearTimeout(t);
    }
  }, [
    remaining,
    turnId,
    isMyTurn,
    localSession.player_id,
    room.current_turn_player_id,
    room.id,
    room.version,
  ]);

  useEffect(() => {
    if (!isMyTurn) setHintInput('');
  }, [isMyTurn]);

  async function handleSubmit() {
    const trimmed = hintInput.trim();
    if (!trimmed || busy || !isMyTurn) return;
    setBusy(true);
    setError(null);
    try {
      await submitHint(
        { roomId: room.id, playerId: localSession.player_id, version: room.version },
        trimmed,
      );
      setHintInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit hint');
    } finally {
      setBusy(false);
    }
  }

  const orderedPlayers = [...gamePlayers]
    .filter((p) => p.alive)
    .sort((a, b) => a.order_index - b.order_index);

  const currentRoundHints = hints.filter((h) => h.round === currentHintRound);
  const previousRoundHints = hints.filter((h) => h.round < currentHintRound);

  return (
    <main className="h-[100dvh] w-full flex flex-col overflow-hidden max-w-md mx-auto">
      {/* Header — fixed height */}
      <header className="shrink-0 px-5 pt-5 pb-3 border-b border-neutral-900">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Round {eliminationRound}</span>
          <span>
            Hint Round {currentHintRound} / {totalHintRounds}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">Category</p>
            <p className="text-xl font-bold text-white">{category}</p>
          </div>
          <span
            className={`text-4xl font-black tabular-nums ${timerColorClass(remaining, hintTimer)}`}
          >
            {remaining}
          </span>
        </div>
      </header>

      {/* Scrollable middle — takes remaining space */}
      <section className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
        <ul className="space-y-2">
          {orderedPlayers.map((p) => {
            const myHint = currentRoundHints.find((h) => h.player_id === p.id);
            const isCurrent = p.id === room.current_turn_player_id;
            const isYou = p.id === localSession.player_id;
            return (
              <li
                key={p.id}
                className={`rounded-lg px-4 py-3 border ${
                  isCurrent
                    ? 'bg-red-500/10 border-red-500/50'
                    : 'bg-neutral-900 border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{p.name}</span>
                    {isYou && (
                      <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 rounded px-1.5 py-0.5">
                        YOU
                      </span>
                    )}
                  </div>
                  {isCurrent && !myHint && (
                    <span className="text-[10px] text-red-400 uppercase tracking-wider">
                      Hinting...
                    </span>
                  )}
                </div>
                <p className="text-sm">
                  {myHint ? (
                    myHint.hint ? (
                      <span className="text-white">&ldquo;{myHint.hint}&rdquo;</span>
                    ) : (
                      <span className="text-neutral-500 italic">[skipped]</span>
                    )
                  ) : (
                    <span className="text-neutral-600">…</span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>

        {previousRoundHints.length > 0 && (
          <details className="mt-4">
            <summary className="text-xs text-neutral-500 cursor-pointer">Previous rounds</summary>
            <ul className="mt-2 space-y-1">
              {previousRoundHints.map((h, i) => (
                <li key={i} className="text-sm text-neutral-400">
                  <span className="text-neutral-500">R{h.round}</span> {h.player_name}:{' '}
                  {h.hint ? `"${h.hint}"` : <em className="text-neutral-600">skipped</em>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Footer — pinned to bottom, always visible */}
      <footer className="shrink-0 px-5 pt-3 pb-5 border-t border-neutral-900 bg-neutral-950">
        {isMyTurn ? (
          <div>
            <p className="text-center text-xs uppercase tracking-widest text-red-400 mb-2">
              It&apos;s your turn
            </p>
            {myPlayer?.role === 'civilian' && (
              <p className="text-center text-xs text-neutral-500 mb-2">
                Your word: <span className="text-white font-semibold">{myPlayer.word}</span>
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={hintInput}
                onChange={(e) => setHintInput(e.target.value.slice(0, 40))}
                placeholder="Type your hint..."
                disabled={busy}
                maxLength={40}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 disabled:opacity-50"
              />
              <button
                type="button"
                disabled={!hintInput.trim() || busy}
                onClick={handleSubmit}
                className="px-5 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-semibold transition"
              >
                {busy ? '...' : 'Submit'}
              </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          </div>
        ) : (
          <p className="text-center text-sm text-neutral-400 py-2">
            {currentTurnPlayer ? `${currentTurnPlayer.name}'s turn...` : 'Waiting...'}
          </p>
        )}
      </footer>
    </main>
  );
}