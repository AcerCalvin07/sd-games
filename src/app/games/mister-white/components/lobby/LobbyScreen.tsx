'use client';

import type { Room, RoomPlayer, LocalSession } from '@/lib/supabase/types';

interface Props {
  room: Room;
  players: RoomPlayer[];
  localSession: LocalSession;
  onGameStarted: () => void;
  onExit: () => void;
}

export default function LobbyScreen({ room, players, localSession, onGameStarted, onExit }: Props) {
  void room;
  void players;
  void localSession;
  void onGameStarted;
  void onExit;
  return <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">LobbyScreen — Artifact 05</div>;
}
