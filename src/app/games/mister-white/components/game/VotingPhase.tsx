'use client';

import type { Room, RoomPlayer, LocalSession } from '@/lib/supabase/types';

interface Props {
  room: Room;
  players: RoomPlayer[];
  localSession: LocalSession;
}

export default function VotingPhase({ room, players, localSession }: Props) {
  void room;
  void players;
  void localSession;
  return <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">VotingPhase — Artifact 06</div>;
}
