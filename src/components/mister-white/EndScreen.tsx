'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loading } from '@/components/common/Loading';
import { useGameState } from '@/hooks/useGameState';
import { getLeaderboard } from '@/services/gameService';
import type { LeaderboardEntry, Room } from '@/types/game';

interface Props {
  room: Room;
  playerId: string;
  onLeave: () => void;
}

export function EndScreen({ room, playerId, onLeave }: Props) {
  const state = useGameState(room, playerId);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLeaderboard(10)
      .then((rows) => {
        if (!cancelled) setLeaderboard(rows);
      })
      .catch(() => {
        if (!cancelled) setLeaderboard([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const winner = state.winner ?? inferWinner(state.players);
  const winnerLabel =
    winner === 'mr_white' ? '🎪 MR. WHITE WINS' : winner === 'civilians' ? '🎉 CIVILIANS WIN' : 'GAME OVER';
  const eliminated = state.players.filter((p) => !p.alive);
  const survivors = state.players.filter((p) => p.alive);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-6 px-4 py-8">
      <h1 className="text-center text-3xl font-bold">{winnerLabel}</h1>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-base font-semibold">Recap</h2>
        <p className="text-xs text-zinc-500">Final round: {state.round}</p>
        <div className="mt-3">
          <div className="text-xs uppercase text-zinc-500">Eliminated</div>
          <ul className="mt-1 flex flex-wrap gap-1">
            {eliminated.length === 0 && <li className="text-xs text-zinc-500">None</li>}
            {eliminated.map((p) => (
              <li
                key={p.id}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs line-through dark:bg-zinc-800"
              >
                {p.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3">
          <div className="text-xs uppercase text-zinc-500">Survivors</div>
          <ul className="mt-1 flex flex-wrap gap-1">
            {survivors.map((p) => (
              <li
                key={p.id}
                className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/40 dark:text-green-200"
              >
                {p.name}
                {p.role === 'mr_white' && ' (Mr. White)'}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-base font-semibold">Leaderboard</h2>
        {leaderboard === null ? (
          <Loading />
        ) : leaderboard.length === 0 ? (
          <p className="text-sm text-zinc-500">No games recorded yet.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {leaderboard.map((row, i) => {
              const winRate =
                row.total_games > 0
                  ? `${Math.round((row.total_wins / row.total_games) * 100)}%`
                  : '—';
              return (
                <li
                  key={row.player_name}
                  className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-2"
                >
                  <span className="text-zinc-500">#{i + 1}</span>
                  <span className="font-medium">{row.player_name}</span>
                  <span className="text-xs text-zinc-500">
                    {row.total_wins}/{row.total_games}
                  </span>
                  <span className="text-xs font-semibold">{winRate}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onLeave}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          Play Again
        </button>
        <Link
          href="/"
          onClick={onLeave}
          className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}

function inferWinner(players: { role: string; alive: boolean }[]): 'civilians' | 'mr_white' | undefined {
  const mr = players.find((p) => p.role === 'mr_white');
  if (!mr) return undefined;
  if (!mr.alive) return 'civilians';
  const civAlive = players.filter((p) => p.role === 'civilian' && p.alive).length;
  if (civAlive <= 1) return 'mr_white';
  return undefined;
}
