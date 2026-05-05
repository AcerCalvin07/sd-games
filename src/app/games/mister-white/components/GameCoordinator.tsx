'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Room, RoomPlayer, LocalSession } from '@/lib/supabase/types';
import { subscribeToRoom } from '@/services/mister-white/realtimeService';
import {
  loadSession,
  saveSession,
  clearSession,
  attemptReconnect,
} from '@/services/mister-white/reconnectService';

import EntryScreen from './entry/EntryScreen';
import HostSetupScreen from './entry/HostSetupScreen';
import JoinScreen from './entry/JoinScreen';
import LobbyScreen from './lobby/LobbyScreen';
import TutorialModal from './game/TutorialModal';
import CategoryVote from './game/CategoryVote';
import RoleRevealModal from './game/RoleRevealModal';
import HintingPhase from './game/HintingPhase';
import VotingPhase from './game/VotingPhase';
import EliminationReveal from './game/EliminationReveal';
import SpectatorView from './game/SpectatorView';
import EndScreen from './end/EndScreen';

type AppScreen = 'loading' | 'entry' | 'host_setup' | 'join' | 'lobby' | 'game' | 'end';

export default function GameCoordinator() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [localSession, setLocalSession] = useState<LocalSession | null>(null);
  const [isAlive, setIsAlive] = useState(true);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      setScreen('entry');
      return;
    }

    attemptReconnect(session).then((result) => {
      if (!result) {
        setScreen('entry');
        return;
      }
      setLocalSession(result.session);
      setRoom(result.room);
      setPlayers(result.players);
      setIsAlive(result.isAlive);

      if (result.phase === 'game_over' || result.room.status === 'finished') {
        setScreen('end');
      } else if (result.room.status === 'waiting' || result.room.status === 'reconfiguring') {
        setScreen('lobby');
      } else {
        setScreen('game');
      }
    });
  }, []);

  useEffect(() => {
    if (!room?.id) return;

    const unsubscribe = subscribeToRoom(room.id, {
      onRoomUpdate: (updatedRoom) => {
        setRoom(updatedRoom);
        if (updatedRoom.phase === 'game_over' || updatedRoom.status === 'finished') {
          setScreen('end');
        } else if (
          updatedRoom.status === 'waiting' ||
          updatedRoom.status === 'reconfiguring'
        ) {
          setScreen('lobby');
        } else if (updatedRoom.status === 'playing') {
          setScreen('game');
        }
      },
      onPlayersUpdate: (updatedPlayers) => {
        setPlayers(updatedPlayers);
        if (localSession) {
          const me = updatedPlayers.find((p) => p.id === localSession.player_id);
          if (me) setIsAlive(me.is_alive);
        }
      },
    });

    return unsubscribe;
  }, [room?.id, localSession]);

  const handleSessionCreated = useCallback(
    (session: LocalSession, roomData: Room, playersData: RoomPlayer[]) => {
      saveSession(session);
      setLocalSession(session);
      setRoom(roomData);
      setPlayers(playersData);
      setScreen('lobby');
    },
    [],
  );

  const handleExit = useCallback(() => {
    clearSession();
    setLocalSession(null);
    setRoom(null);
    setPlayers([]);
    setScreen('entry');
    window.location.href = '/';
  }, []);

  const renderGamePhase = () => {
    if (!room || !localSession) return null;
    const phase = room.phase;
    const gameState = room.game_state;
    const myPlayer = gameState?.players?.find((p) => p.id === localSession.player_id);

    if (!isAlive && (phase === 'hinting' || phase === 'voting')) {
      return <SpectatorView room={room} players={players} localSession={localSession} />;
    }

    switch (phase) {
      case 'tutorial':
        return <TutorialModal room={room} localSession={localSession} />;
      case 'category_vote':
        return <CategoryVote room={room} localSession={localSession} />;
      case 'role_reveal':
        return (
          <RoleRevealModal room={room} localSession={localSession} myPlayer={myPlayer ?? null} />
        );
      case 'hinting':
        return <HintingPhase room={room} players={players} localSession={localSession} />;
      case 'voting':
        return <VotingPhase room={room} players={players} localSession={localSession} />;
      case 'elimination_reveal':
        return <EliminationReveal room={room} localSession={localSession} />;
      default:
        return null;
    }
  };

  switch (screen) {
    case 'loading':
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-neutral-400 text-sm animate-pulse">Connecting...</p>
        </div>
      );

    case 'entry':
      return (
        <EntryScreen onHost={() => setScreen('host_setup')} onJoin={() => setScreen('join')} />
      );

    case 'host_setup':
      return <HostSetupScreen onBack={() => setScreen('entry')} onCreated={handleSessionCreated} />;

    case 'join':
      return <JoinScreen onBack={() => setScreen('entry')} onJoined={handleSessionCreated} />;

    case 'lobby':
      return room && localSession ? (
        <LobbyScreen
          room={room}
          players={players}
          localSession={localSession}
          onGameStarted={() => setScreen('game')}
          onExit={handleExit}
        />
      ) : null;

    case 'game':
      return <div className="min-h-screen w-full">{renderGamePhase()}</div>;

    case 'end':
      return room && localSession ? (
        <EndScreen
          room={room}
          players={players}
          localSession={localSession}
          onPlayAgain={() => setScreen('lobby')}
          onExit={handleExit}
        />
      ) : null;

    default:
      return null;
  }
}
