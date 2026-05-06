'use client';

import type { Room, RoomPlayer, LocalSession, GamePlayer, HintEntry } from '@/lib/supabase/types';

interface Props {
  room: Room;
  players: RoomPlayer[];
  localSession: LocalSession;
}

export default function SpectatorView({ room, players, localSession }: Props) {
  void players;

  const gamePlayers: GamePlayer[] = room.game_state.players ?? [];
  const hints: HintEntry[] = room.game_state.hints ?? [];
  const votes = room.game_state.votes ?? [];
  const myPlayer = gamePlayers.find((p) => p.id === localSession.player_id);
  const phase = room.phase;
  const category = room.game_state.category;

  const phaseLabel =
    phase === 'hinting' ? 'Hinting' : phase === 'voting' ? 'Voting' : (phase ?? '');

  return (
    <main className="min-h-screen w-full flex flex-col px-5 py-5 max-w-md mx-auto">
      <header className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-4 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-red-400 mb-1">You were eliminated</p>
        {myPlayer && (
          <p className="text-sm text-neutral-300">
            You were{' '}
            <span className="text-white font-semibold">
              {myPlayer.role === 'mr_white' ? 'Mr. White' : 'a Civilian'}
            </span>
            {myPlayer.role === 'civilian' && myPlayer.word && (
              <>
                . Word: <span className="text-white font-semibold">{myPlayer.word}</span>
              </>
            )}
          </p>
        )}
        <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-2">
          Spectating · {phaseLabel} · {category}
        </p>
      </header>

      <section className="mb-4">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Players</h2>
        <ul className="space-y-1.5">
          {gamePlayers
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map((p) => (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
                  p.alive
                    ? 'bg-neutral-900 border-neutral-800'
                    : 'bg-neutral-950 border-neutral-900 opacity-50'
                }`}
              >
                <span className={`text-sm ${p.alive ? 'text-white' : 'line-through text-neutral-500'}`}>
                  {p.name}
                </span>
                {!p.alive && <span className="text-[10px] text-neutral-600">eliminated</span>}
              </li>
            ))}
        </ul>
      </section>

      <section className="flex-1 overflow-y-auto">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Hints</h2>
        {hints.length === 0 ? (
          <p className="text-neutral-600 text-xs">No hints yet.</p>
        ) : (
          <ul className="space-y-1">
            {hints.map((h, i) => (
              <li key={i} className="text-sm text-neutral-300">
                <span className="text-neutral-500">R{h.round}</span> {h.player_name}:{' '}
                {h.hint ? (
                  <span className="text-white">&ldquo;{h.hint}&rdquo;</span>
                ) : (
                  <em className="text-neutral-600">skipped</em>
                )}
              </li>
            ))}
          </ul>
        )}

        {phase === 'voting' && votes.length > 0 && (
          <div className="mt-4">
            <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Votes</h2>
            <ul className="space-y-0.5">
              {gamePlayers
                .filter((p) => p.alive)
                .map((p) => {
                  const count = votes.reduce(
                    (acc, v) => acc + (v.target_id === p.id ? 1 : 0),
                    0,
                  );
                  return (
                    <li key={p.id} className="text-xs text-neutral-400 flex justify-between">
                      <span>{p.name}</span>
                      <span>
                        {count} vote{count === 1 ? '' : 's'}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
