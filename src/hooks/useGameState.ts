'use client';

import { useMemo } from 'react';
import type { GamePlayer, GameState, Room } from '@/types/game';

interface DerivedState {
  round: number;
  category: string;
  players: GamePlayer[];
  turnsTaken: string[];
  votes: GameState['votes'];
  phase: Room['phase'];
  aliveCount: number;
  isGameOver: boolean;
  winner: GameState['winner'];
}

const EMPTY: GameState = {
  round: 0,
  category: '',
  players: [],
  turns_taken: [],
  votes: [],
};

export function useGameState(room: Room | null, currentPlayerId: string | null): DerivedState {
  return useMemo(() => {
    if (!room) {
      return {
        round: 0,
        category: '',
        players: [],
        turnsTaken: [],
        votes: [],
        phase: 'waiting',
        aliveCount: 0,
        isGameOver: false,
        winner: undefined,
      };
    }

    const state = (room.game_state ?? EMPTY) as GameState;
    const reveal = room.phase === 'finished' || room.status === 'finished';

    const players: GamePlayer[] = (state.players ?? []).map((p) => {
      if (reveal || p.id === currentPlayerId) return p;
      return { ...p, role: 'civilian', word: p.word };
    });

    return {
      round: state.round ?? 0,
      category: state.category ?? '',
      players,
      turnsTaken: state.turns_taken ?? [],
      votes: state.votes ?? [],
      phase: room.phase,
      aliveCount: players.filter((p) => p.alive).length,
      isGameOver: room.status === 'finished',
      winner: state.winner,
    };
  }, [room, currentPlayerId]);
}
