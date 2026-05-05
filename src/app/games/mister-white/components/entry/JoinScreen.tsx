'use client';

import type { LocalSession, Room, RoomPlayer } from '@/lib/supabase/types';

interface Props {
  onBack: () => void;
  onJoined: (session: LocalSession, room: Room, players: RoomPlayer[]) => void;
}

export default function JoinScreen({ onBack, onJoined }: Props) {
  void onBack;
  void onJoined;
  return <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">JoinScreen — Artifact 05</div>;
}
