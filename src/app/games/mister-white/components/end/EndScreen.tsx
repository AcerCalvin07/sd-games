'use client';

import type { Room, RoomPlayer, LocalSession } from '@/lib/supabase/types';

interface Props {
  room: Room;
  players: RoomPlayer[];
  localSession: LocalSession;
  onPlayAgain: () => void;
  onExit: () => void;
}

export default function EndScreen({ room, players, localSession, onPlayAgain, onExit }: Props) {
  void room;
  void players;
  void localSession;
  void onPlayAgain;
  void onExit;
  return <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">EndScreen — Artifact 07</div>;
}
