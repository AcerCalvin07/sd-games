export type GamePhase =
  | 'waiting'
  | 'role_assignment'
  | 'hinting'
  | 'voting'
  | 'elimination'
  | 'finished';

export type PlayerRole = 'civilian' | 'mr_white';
export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Hint {
  player_id: string;
  player_name: string;
  hint: string;
  timestamp: string;
}

export interface Vote {
  voter_id: string;
  voter_name: string;
  voted_for_id: string;
  timestamp: string;
}

export interface GamePlayer {
  id: string;
  name: string;
  role: PlayerRole;
  alive: boolean;
  word: string | null;
}

export interface GameState {
  round: number;
  category: string;
  players: GamePlayer[];
  hints: Hint[];
  votes: Vote[];
  winner?: 'civilians' | 'mr_white';
  eliminated?: { round: number; player_id: string; player_name: string }[];
}

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  host_player_id: string;
  current_turn_player_id: string | null;
  phase: GamePhase;
  game_state: GameState;
  version: number;
  created_at: string;
}

export interface RoomPlayer {
  id: string;
  room_id: string;
  name: string;
  is_alive: boolean;
  order_index: number | null;
  is_host: boolean;
  connected: boolean;
  last_seen_at: string;
}

export type ActionPayload =
  | { type: 'START_GAME' }
  | { type: 'SUBMIT_HINT'; payload: { hint: string } }
  | { type: 'VOTE'; payload: { voted_for_id: string } }
  | { type: 'RECONNECT' };

export interface ActionResult {
  success: boolean;
  error?: string;
  message?: string;
}

export interface LeaderboardEntry {
  player_name: string;
  total_wins: number;
  total_games: number;
}
