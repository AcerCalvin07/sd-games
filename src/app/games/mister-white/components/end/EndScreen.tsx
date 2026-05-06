'use client';

import { useEffect, useState } from 'react';
import type { Room, RoomPlayer, LocalSession, GamePlayer, HintEntry } from '@/lib/supabase/types';
import { playAgain } from '@/services/mister-white/roomService';
import { clearSession } from '@/services/mister-white/reconnectService';
import { getTopPlayers, type LeaderboardEntry } from '@/services/mister-white/leaderboardService';

interface Props {
  room: Room;
  players: RoomPlayer[];
  localSession: LocalSession;
  onPlayAgain: () => void;
  onExit: () => void;
}

export default function EndScreen({ room, players, localSession, onPlayAgain, onExit }: Props) {
  void players;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [leaderboardError, setLeaderboardError] = useState(false);
  const [showHints, setShowHints] = useState(false);

  const winner = room.game_state?.winner ?? null;
  const gamePlayers: GamePlayer[] = room.game_state?.players ?? [];
  const hints: HintEntry[] = room.game_state?.hints ?? [];
  const mrWhite = gamePlayers.find((p) => p.role === 'mr_white');
  const word = gamePlayers.find((p) => p.role === 'civilian')?.word ?? room.game_state?.word ?? null;
  const isHost = localSession.is_host;
  const civiliansWin = winner === 'civilians';

  // Leaderboard fetch — small delay so the win-update transaction commits.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getTopPlayers(10)
        .then((data) => {
          if (!cancelled) setLeaderboard(data);
        })
        .catch(() => {
          if (!cancelled) setLeaderboardError(true);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  async function handlePlayAgain() {
    if (busy || !isHost) return;
    setBusy(true);
    setError(null);
    try {
      await playAgain(room.id, localSession.player_id);
      onPlayAgain();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to restart');
      setBusy(false);
    }
  }

  function handleExit() {
    clearSession();
    onExit();
  }

  // Sort: Mr. White first, then survivors, then eliminated (by order_index).
  const sortedPlayers = [...gamePlayers].sort((a, b) => {
    if (a.role === 'mr_white' && b.role !== 'mr_white') return -1;
    if (b.role === 'mr_white' && a.role !== 'mr_white') return 1;
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return a.order_index - b.order_index;
  });

  const hintsByRound = hints.reduce<Record<number, HintEntry[]>>((acc, h) => {
    (acc[h.round] ??= []).push(h);
    return acc;
  }, {});

  return (
    <main className="min-h-screen w-full flex flex-col px-5 py-6 max-w-md mx-auto">
      <WinnerBanner civiliansWin={civiliansWin} mrWhiteName={mrWhite?.name} word={word} />

      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Players</h2>
        <ul className="space-y-1.5">
          {sortedPlayers.map((p) => {
            const isYou = p.id === localSession.player_id;
            const isMrWhite = p.role === 'mr_white';
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${
                  isMrWhite
                    ? 'bg-red-600/10 border-red-500/40'
                    : 'bg-neutral-900 border-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white truncate">{p.name}</span>
                  {isYou && (
                    <span className="text-[10px] text-neutral-400 bg-neutral-800 rounded px-1.5 py-0.5">
                      YOU
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-semibold tracking-wider rounded px-1.5 py-0.5 ${
                      isMrWhite
                        ? 'text-red-300 bg-red-500/20 border border-red-500/40'
                        : 'text-neutral-300 bg-neutral-800 border border-neutral-700'
                    }`}
                  >
                    {isMrWhite ? 'MR. WHITE' : 'CIVILIAN'}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-semibold tracking-wider ${
                    p.alive ? 'text-green-400' : 'text-neutral-500'
                  }`}
                >
                  {p.alive ? 'SURVIVED' : 'ELIMINATED'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-4">
        <button
          type="button"
          onClick={() => setShowHints((s) => !s)}
          className="text-xs text-neutral-400 hover:text-white"
        >
          {showHints ? '▼' : '▶'} View hints ({hints.length})
        </button>
        {showHints && (
          <div className="mt-2 bg-neutral-900 border border-neutral-800 rounded-lg p-3 max-h-48 overflow-y-auto">
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
      </section>

      <section className="mt-4">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Top Players</h2>
        <Leaderboard data={leaderboard} error={leaderboardError} highlight={localSession.player_name} />
      </section>

      {error && <p className="text-red-500 text-sm text-center mt-3">{error}</p>}

      <div className="mt-auto pt-6 flex flex-col gap-2">
        {isHost ? (
          <button
            type="button"
            disabled={busy}
            onClick={handlePlayAgain}
            className="w-full min-h-[52px] rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold tracking-wider transition"
          >
            {busy ? 'Loading...' : 'PLAY AGAIN'}
          </button>
        ) : (
          <p className="text-center text-sm text-neutral-400">Waiting for host...</p>
        )}
        <button
          type="button"
          onClick={handleExit}
          className="w-full min-h-[44px] rounded-xl bg-transparent border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white text-sm font-semibold transition"
        >
          EXIT
        </button>
      </div>
    </main>
  );
}

function WinnerBanner({
  civiliansWin,
  mrWhiteName,
  word,
}: {
  civiliansWin: boolean;
  mrWhiteName: string | undefined;
  word: string | null;
}) {
  if (civiliansWin) {
    return (
      <header className="rounded-2xl p-6 text-center bg-blue-600/10 border-2 border-blue-500/40">
        <h1 className="text-3xl font-black tracking-tight text-blue-300">CIVILIANS WIN</h1>
        <p className="text-sm text-blue-200/80 mt-1">Mr. White has been found out</p>
        {mrWhiteName && (
          <p className="mt-4 text-sm text-neutral-300">
            Mr. White was <span className="text-white font-semibold">{mrWhiteName}</span>
          </p>
        )}
        {word && (
          <p className="text-sm text-neutral-300">
            The word was <span className="text-white font-semibold">{word}</span>
          </p>
        )}
      </header>
    );
  }

  return (
    <header className="rounded-2xl p-6 text-center bg-red-600/15 border-2 border-red-500/50">
      <h1 className="text-3xl font-black tracking-tight text-red-400">MR. WHITE WINS</h1>
      <p className="text-sm text-red-200/80 mt-1">
        {mrWhiteName ? `${mrWhiteName} fooled everyone` : 'The impostor wins'}
      </p>
      <p className="mt-4 text-sm text-neutral-300">Mr. White had no word</p>
      {word && (
        <p className="text-sm text-neutral-300">
          The word was <span className="text-white font-semibold">{word}</span>
        </p>
      )}
    </header>
  );
}

function Leaderboard({
  data,
  error,
  highlight,
}: {
  data: LeaderboardEntry[] | null;
  error: boolean;
  highlight: string;
}) {
  if (error) {
    return <p className="text-xs text-neutral-500">Leaderboard unavailable</p>;
  }
  if (data === null) {
    return (
      <ul className="space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="bg-neutral-900 border border-neutral-800 rounded-lg h-9 animate-pulse"
          />
        ))}
      </ul>
    );
  }
  if (data.length === 0) {
    return <p className="text-xs text-neutral-500">No leaderboard entries yet</p>;
  }

  return (
    <ul className="space-y-1">
      {data.map((entry, i) => {
        const winRate =
          entry.total_games > 0 ? Math.round((entry.total_wins / entry.total_games) * 100) : 0;
        const isMe = entry.player_name === highlight;
        return (
          <li
            key={entry.player_name}
            className={`flex items-center justify-between rounded-lg px-3 py-2 border text-sm ${
              isMe
                ? 'bg-red-500/10 border-red-500/40'
                : 'bg-neutral-900 border-neutral-800'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-neutral-500 text-xs w-5 tabular-nums">{i + 1}</span>
              <span className="text-white truncate">{entry.player_name}</span>
            </div>
            <div className="text-xs text-neutral-400 tabular-nums shrink-0">
              {entry.total_wins} / {entry.total_games} · {winRate}%
            </div>
          </li>
        );
      })}
    </ul>
  );
}
