'use client';

import type { Room, LocalSession } from '@/lib/supabase/types';

interface Props {
  room: Room;
  localSession: LocalSession;
}

export default function CategoryVote({ room, localSession }: Props) {
  void room;
  void localSession;
  return <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">CategoryVote — Artifact 06</div>;
}
