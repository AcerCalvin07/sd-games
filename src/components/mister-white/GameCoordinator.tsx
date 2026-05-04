'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loading } from '@/components/common/Loading';
import { useRoom } from '@/hooks/useRoom';
import { useRoomPlayers } from '@/hooks/usePlayer';
import { SESSION_KEY } from '@/utils/constants';
import { EndScreen } from './EndScreen';
import { GameBoard } from './GameBoard';
import { LobbyScreen } from './LobbyScreen';

interface Session {
  roomId: string;
  playerId: string;
}

function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null): void {
  if (typeof window === 'undefined') return;
  if (s) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else window.sessionStorage.removeItem(SESSION_KEY);
}

export function GameCoordinator() {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setHydrated(true);
  }, []);

  const { room, loading: roomLoading, error: roomError } = useRoom(session?.roomId ?? null);
  const { players } = useRoomPlayers(session?.roomId ?? null);

  const onJoined = useCallback((roomId: string, playerId: string) => {
    const s: Session = { roomId, playerId };
    saveSession(s);
    setSession(s);
  }, []);

  const onLeave = useCallback(() => {
    saveSession(null);
    setSession(null);
  }, []);

  if (!hydrated) return <Loading />;

  if (!session) {
    return <LobbyScreen mode="entry" onJoined={onJoined} />;
  }

  if (roomError) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="mb-4 text-red-600">{roomError}</p>
        <button
          onClick={onLeave}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to lobby
        </button>
      </div>
    );
  }

  if (roomLoading || !room) return <Loading label="Loading room…" />;

  if (room.status === 'finished') {
    return <EndScreen room={room} playerId={session.playerId} onLeave={onLeave} />;
  }

  if (room.status === 'playing') {
    return <GameBoard room={room} playerId={session.playerId} players={players} />;
  }

  return (
    <LobbyScreen
      mode="in-room"
      room={room}
      players={players}
      playerId={session.playerId}
      onLeave={onLeave}
    />
  );
}
