'use client';

import { useEffect, useRef, useState } from 'react';
import type { Room, RoomPlayer, LocalSession, GamePlayer, HintEntry } from '@/lib/supabase/types';
import { castVote, resolveVote } from '@/services/mister-white/gameService';
import { useCountdown, timerColorClass } from '@/hooks/mister-white/useCountdown';
import { useToast } from '@/components/ui/Toast';

interface Props {
  room: Room;
  players: RoomPlayer[];
  localSession: LocalSession;
}

export default function VotingPhase({ room, players, localSession }: Props) {
  void players;
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [showHints, setShowHints] = useState(false);

  const gamePlayers: GamePlayer[] = room.game_state.players ?? [];
  const hints: HintEntry[] = room.game_state.hints ?? [];
  const votes = room.game_state.votes ?? [];

  const myVote = votes.find((v) => v.voter_id === localSession.player_id);
  const eliminationsPerVote = room.settings.eliminations_per_vote;
  const voteTimer = room.settings.vote_timer;
  const startedAt = room.game_state.voting_phase_started_at ?? null;
  const remaining = useCountdown(startedAt, voteTimer);

  const phaseId = `voting|${startedAt ?? 0}`;
  const resolveFiredRef = useRef<string | null>(null);

  // Host fires resolve when timer expires
  useEffect(() => {
    if (remaining > 0 || !localSession.is_host) return;
    if (resolveFiredRef.current === phaseId) return;
    resolveFiredRef.current = phaseId;
    resolveVote({
      roomId: room.id,
      playerId: localSession.player_id,
      version: room.version,
    }).catch(() => {
      resolveFiredRef.current = null;
    });
  }, [remaining, localSession.is_host, localSession.player_id, room.id, room.version, phaseId]);

  const candidates = gamePlayers.filter((p) => p.alive && p.id !== localSession.player_id);

  function voteCountFor(targetId: string): number {
    return votes.reduce((acc, v) => acc + (v.target_id === targetId ? 1 : 0), 0);
  }

  async function vote(targetId: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      await castVote(
        { roomId: room.id, playerId: localSession.player_id, version: room.version },
        targetId,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to vote');
    } finally {
      setBusy(false);
    }
  }

  const myTarget = myVote?.target_id ?? undefined;
  const skipChosen = myVote !== undefined && myVote.target_id === null;

  const hintsByRound = hints.reduce<Record<number, HintEntry[]>>((acc, h) => {
    (acc[h.round] ??= []).push(h);
    return acc;
  }, {});

  return (
    <main className="min-h-screen w-full flex flex-col px-5 py-5 max-w-md mx-auto">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-white tracking-tight">VOTE TO ELIMINATE</h1>
          <span
            className={`text-3xl font-black tabular-nums ${timerColorClass(remaining, voteTimer)}`}
          >
            {remaining}
          </span>
        </div>
        <p className="text-neutral-500 text-xs mt-1">
          Tap a player to vote. Top {eliminationsPerVote} will be eliminated.
        </p>
      </header>

      <button
        type="button"
        onClick={() => setShowHints((s) => !s)}
        className="text-left mb-3 text-xs text-neutral-400 hover:text-white"
      >
        {showHints ? '▼' : '▶'} Hints reference
      </button>
      {showHints && (
        <div className="mb-4 bg-neutral-900 border border-neutral-800 rounded-lg p-3 max-h-48 overflow-y-auto">
          {Object.keys(hintsByRound).length === 0 && (
            <p className="text-xs text-neutral-500">No hints recorded.</p>
          )}
          {Object.entries(hintsByRound).map(([round, list]) => (
            <div key={round} className="mb-2 last:mb-0">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                Round {round}
              </p>
              <ul className="space-y-0.5">
                {list.map((h, i) => (
                  <li key={i} className="text-xs text-neutral-300">
                    <span className="text-neutral-500">{h.player_name}:</span>{' '}
                    {h.hint ? `"${h.hint}"` : <em className="text-neutral-600">skipped</em>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <ul className="flex-1 space-y-2 overflow-y-auto">
        {candidates.map((p) => {
          const count = voteCountFor(p.id);
          const isSelected = myTarget === p.id;
          const playerHints = hints
            .filter((h) => h.player_id === p.id)
            .map((h) => (h.hint ? `"${h.hint}"` : 'skipped'))
            .join(', ');
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => vote(p.id)}
                className={`w-full text-left rounded-lg px-4 py-3 border-2 transition ${
                  isSelected
                    ? 'bg-red-600/15 border-red-500'
                    : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{p.name}</span>
                  <span className="text-xs text-neutral-400">
                    {count} vote{count === 1 ? '' : 's'}
                  </span>
                </div>
                {playerHints && (
                  <p className="text-xs text-neutral-500 mt-1 truncate">{playerHints}</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => vote(null)}
          className={`w-full min-h-[52px] rounded-xl border font-semibold transition ${
            skipChosen
              ? 'bg-neutral-700 border-neutral-500 text-white'
              : 'bg-transparent border-neutral-700 hover:border-neutral-500 text-neutral-300'
          }`}
        >
          {skipChosen ? 'Skipped' : 'Skip vote'}
        </button>
      </div>
    </main>
  );
}