'use client';

import { useEffect, useMemo, useState } from 'react';
import { executeAction } from '@/services/gameService';
import type { GamePlayer, Vote } from '@/types/game';

interface Props {
  roomId: string;
  playerId: string;
  version: number;
  players: GamePlayer[];
  votes: Vote[];
  isAlive: boolean;
  voteTimerSeconds: number;
  phaseStartedAt: string | null;
}

function computeRemaining(total: number, startedAt: string | null): number {
  if (!startedAt) return total;
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(total - elapsed));
}

export function VotingUI({
  roomId,
  playerId,
  version,
  players,
  votes,
  isAlive,
  voteTimerSeconds,
  phaseStartedAt,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    computeRemaining(voteTimerSeconds, phaseStartedAt),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setSecondsLeft(computeRemaining(voteTimerSeconds, phaseStartedAt));
    const tick = setInterval(() => {
      setSecondsLeft(computeRemaining(voteTimerSeconds, phaseStartedAt));
    }, 1000);
    return () => clearInterval(tick);
  }, [voteTimerSeconds, phaseStartedAt]);

  const myVote = useMemo(
    () => votes.find((v) => v.voter_id === playerId)?.voted_for_id ?? null,
    [votes, playerId],
  );

  const tally = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of votes) {
      counts.set(v.voted_for_id, (counts.get(v.voted_for_id) ?? 0) + 1);
    }
    return counts;
  }, [votes]);

  const vote = async (targetId: string) => {
    if (!isAlive || secondsLeft === 0 || submitting) return;
    setError(null);
    setPending(targetId);
    setSubmitting(true);
    const res = await executeAction(
      roomId,
      playerId,
      { type: 'VOTE', payload: { voted_for_id: targetId } },
      version,
    );
    setSubmitting(false);
    setPending(null);
    if (!res.success) setError(res.error ?? 'Failed to vote');
  };

  const alivePlayers = players.filter((p) => p.alive);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Voting Phase</h2>
        <span
          className={`font-mono text-base ${
            secondsLeft <= 10 ? 'text-red-600' : 'text-zinc-500'
          }`}
        >
          {secondsLeft}s
        </span>
      </header>

      {!isAlive && (
        <p className="text-sm text-zinc-500">You were eliminated. Spectating only.</p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {alivePlayers.map((p) => {
          const selected = myVote === p.id || pending === p.id;
          const count = tally.get(p.id) ?? 0;
          const disabled = !isAlive || secondsLeft === 0 || p.id === playerId;
          return (
            <button
              key={p.id}
              disabled={disabled}
              onClick={() => void vote(p.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm transition ${
                selected
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-zinc-200 hover:border-blue-400 dark:border-zinc-700'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-zinc-500">{count} vote(s)</span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
