'use client';

import type { LocalSession, Room, RoomPlayer } from '@/lib/supabase/types';

interface Props {
  onBack: () => void;
  onCreated: (session: LocalSession, room: Room, players: RoomPlayer[]) => void;
}

export default function HostSetupScreen({ onBack, onCreated }: Props) {
  void onBack;
  void onCreated;
  return <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">HostSetupScreen — Artifact 05</div>;
}
