'use client';

import { useGameState } from '@/hooks/useGameState';
import type { Room, RoomPlayer } from '@/types/game';
import { HintSubmissionModal } from './HintSubmissionModal';
import { VotingUI } from './VotingUI';

interface Props {
  room: Room;
  players: RoomPlayer[];
  playerId: string;
}

export function GameBoard({ room, players, playerId }: Props) {
  const state = useGameState(room, playerId);
  const me = state.players.find((p) => p.id === playerId);
  const myWord = me?.word ?? null;
  const myAlive = me?.alive ?? false;
  const isMyTurn = room.current_turn_player_id === playerId;
  const turnPlayer = players.find((p) => p.id === room.current_turn_player_id);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Mister White</h1>
          <p className="text-xs text-zinc-500">
            Round {state.round} · Phase: {state.phase}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-100 px-3 py-1 text-xs dark:bg-zinc-800">
          Category: <span className="font-semibold">{state.category || '—'}</span>
        </div>
      </header>

      <section className="flex flex-wrap gap-2">
        {state.players.map((p) => {
          const isTurn = p.id === room.current_turn_player_id;
          return (
            <span
              key={p.id}
              className={`rounded-full border px-3 py-1 text-xs ${
                !p.alive
                  ? 'border-zinc-300 bg-zinc-100 text-zinc-400 line-through dark:border-zinc-700 dark:bg-zinc-800'
                  : isTurn
                    ? 'border-blue-600 bg-blue-50 font-bold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                    : 'border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {p.name}
              {p.id === playerId && ' (you)'}
            </span>
          );
        })}
      </section>

      {state.phase === 'hinting' && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          {isMyTurn ? (
            <p className="text-lg font-bold text-blue-600">It&apos;s your turn!</p>
          ) : (
            <p className="text-base">
              Waiting for{' '}
              <span className="font-semibold">{turnPlayer?.name ?? '…'}</span>
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Hints</h2>
        <ul className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
          {state.hints.length === 0 && (
            <li className="text-sm text-zinc-500">No hints yet.</li>
          )}
          {state.hints.map((h, i) => (
            <li
              key={`${h.player_id}-${i}`}
              className="rounded-lg border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="font-medium">{h.player_name}:</span> {h.hint}
            </li>
          ))}
        </ul>
      </section>

      {state.phase === 'voting' && (
        <VotingUI
          roomId={room.id}
          playerId={playerId}
          version={room.version}
          players={state.players}
          votes={state.votes}
          isAlive={myAlive}
        />
      )}

      {state.phase === 'hinting' && isMyTurn && myAlive && (
        <HintSubmissionModal
          roomId={room.id}
          playerId={playerId}
          version={room.version}
          category={state.category}
          word={myWord}
        />
      )}
    </main>
  );
}
