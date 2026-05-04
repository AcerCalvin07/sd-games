'use client';

import { useGameState } from '@/hooks/useGameState';
import type { Room, RoomPlayer } from '@/types/game';
import { TurnModal } from './TurnModal';
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
  const turnsTaken = new Set(state.turnsTaken);

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
          const done = turnsTaken.has(p.id);
          return (
            <span
              key={p.id}
              className={`rounded-full border px-3 py-1 text-xs ${
                !p.alive
                  ? 'border-zinc-300 bg-zinc-100 text-zinc-400 line-through dark:border-zinc-700 dark:bg-zinc-800'
                  : isTurn
                    ? 'border-blue-600 bg-blue-50 font-bold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                    : done
                      ? 'border-zinc-200 text-zinc-400 dark:border-zinc-700'
                      : 'border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {done && p.alive && !isTurn && '✓ '}
              {p.name}
              {p.id === playerId && ' (you)'}
            </span>
          );
        })}
      </section>

      {state.phase === 'hinting' && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase text-zinc-500">
            Turns this round: {state.turnsTaken.length}/{state.aliveCount}
          </p>
          {isMyTurn ? (
            <p className="mt-1 text-lg font-bold text-blue-600">It&apos;s your turn!</p>
          ) : (
            <p className="mt-1 text-base">
              Waiting for{' '}
              <span className="font-semibold">{turnPlayer?.name ?? '…'}</span> to finish
              their turn
            </p>
          )}
        </section>
      )}

      {state.phase === 'voting' && (
        <VotingUI
          roomId={room.id}
          playerId={playerId}
          version={room.version}
          players={state.players}
          votes={state.votes}
          isAlive={myAlive}
          voteTimerSeconds={room.vote_timer_seconds}
          phaseStartedAt={room.phase_started_at}
        />
      )}

      {state.phase === 'hinting' && isMyTurn && myAlive && (
        <TurnModal
          roomId={room.id}
          playerId={playerId}
          version={room.version}
          category={state.category}
          word={myWord}
          hintTimerSeconds={room.hint_timer_seconds}
        />
      )}
    </main>
  );
}
