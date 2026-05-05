'use client';

import type { Room, LocalSession, GamePlayer } from '@/lib/supabase/types';

interface Props {
  room: Room;
  localSession: LocalSession;
  myPlayer: GamePlayer | null;
}

export default function RoleRevealModal({ room, localSession, myPlayer }: Props) {
  void room;
  void localSession;
  void myPlayer;
  return <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">RoleRevealModal — Artifact 06</div>;
}
