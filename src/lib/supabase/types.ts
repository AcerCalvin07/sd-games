export type RoomStatus = 'waiting' | 'reconfiguring' | 'playing' | 'finished';

export type GamePhase =
  | 'tutorial'
  | 'category_vote'
  | 'role_reveal'
  | 'hinting'
  | 'voting'
  | 'elimination_reveal'
  | 'game_over';

export type PlayerRole = 'civilian' | 'mr_white';

export type RoomSettings = {
  hint_timer: number;
  vote_timer: number;
  min_players: number;
  max_players: number;
  rounds_before_voting: number;
  eliminations_per_vote: number;
};

export type GamePlayer = {
  id: string;
  name: string;
  role: PlayerRole;
  word: string | null;
  alive: boolean;
  order_index: number;
  acknowledged: boolean;
  ready: boolean;
};

export type HintEntry = {
  player_id: string;
  player_name: string;
  hint: string | null;
  round: number;
  submitted_at: number;
};

export type VoteEntry = {
  voter_id: string;
  target_id: string | null
  voted_at: number;
};

export type EliminatedPlayer = {
  id: string;
  name: string;
  role: PlayerRole;
  word: string | null;
};

export type GameState = {
  round: number;
  category: string | null;
  word: string | null;
  category_options: string[];
  category_votes: { player_id: string; category: string }[];
  players: GamePlayer[];
  hints: HintEntry[];
  votes: VoteEntry[];
  ready_players: string[];
  acknowledged_players: string[];
  winner: 'civilians' | 'mr_white' | null;
  current_hint_round: number;
  hint_turn_started_at: number | null;
  voting_phase_started_at: number | null;
  eliminated_this_round: EliminatedPlayer[];
};

export type Room = {
  id: string;
  code: string;
  status: RoomStatus;
  host_player_id: string;
  current_turn_player_id: string | null;
  phase: GamePhase | null;
  game_state: GameState;
  settings: RoomSettings;
  version: number;
  created_at: string;
  updated_at: string;
};

export type RoomPlayer = {
  id: string;
  room_id: string;
  name: string;
  is_alive: boolean;
  order_index: number | null;
  is_host: boolean;
  connected: boolean;
  ready: boolean;
  last_seen_at: string;
  joined_at: string;
};

export type LocalSession = {
  room_id: string;
  player_id: string;
  player_name: string;
  room_code: string;
  is_host: boolean;
};

type GameSessionRow = { id: string; room_id: string; winner: string; created_at: string; ended_at: string };
type LeaderboardRow = { player_name: string; total_wins: number; total_games: number; updated_at: string };
type WordBankRow = { id: string; category: string; word: string };

export type Database = {
  public: {
    Views: Record<string, never>;
    Tables: {
      rooms: { Row: Room; Insert: Partial<Room>; Update: Partial<Room>; Relationships: [] };
      room_players: {
        Row: RoomPlayer;
        Insert: Partial<RoomPlayer>;
        Update: Partial<RoomPlayer>;
        Relationships: [];
      };
      game_sessions: {
        Row: GameSessionRow;
        Insert: Partial<GameSessionRow>;
        Update: Partial<GameSessionRow>;
        Relationships: [];
      };
      leaderboard: {
        Row: LeaderboardRow;
        Insert: Partial<LeaderboardRow>;
        Update: Partial<LeaderboardRow>;
        Relationships: [];
      };
      word_bank: {
        Row: WordBankRow;
        Insert: Partial<WordBankRow>;
        Update: Partial<WordBankRow>;
        Relationships: [];
      };
    };
    Functions: {
      create_room: {
        Args: { p_host_name: string; p_settings: RoomSettings };
        Returns: { room_id: string; player_id: string; code: string };
      };
      join_room: {
        Args: { p_code: string; p_player_name: string };
        Returns: {
          room_id: string;
          player_id: string;
          code: string;
          status: RoomStatus;
          phase: GamePhase;
          settings: RoomSettings;
          game_state: GameState;
        };
      };
      handle_action: {
        Args: {
          p_room_id: string;
          p_player_id: string;
          p_action_type: string;
          p_payload: Record<string, unknown>;
          p_expected_version: number;
        };
        Returns: { success: boolean; phase?: GamePhase; winner?: string };
      };
      play_again: {
        Args: { p_room_id: string; p_player_id: string };
        Returns: { success: boolean; status: RoomStatus };
      };
      finish_reconfigure: {
        Args: { p_room_id: string; p_player_id: string };
        Returns: { success: boolean; status: RoomStatus };
      };
      player_disconnect: {
        Args: { p_player_id: string };
        Returns: void;
      };
      player_reconnect: {
        Args: { p_room_code: string; p_player_name: string };
        Returns: {
          room_id: string;
          player_id: string;
          code: string;
          status: RoomStatus;
          phase: GamePhase;
          host_player_id: string;
          current_turn_player_id: string | null;
          game_state: GameState;
          settings: RoomSettings;
          version: number;
          created_at: string;
          updated_at: string;
          is_host: boolean;
          is_alive: boolean;
        };
      };
      update_room_settings: {
        Args: { p_room_id: string; p_player_id: string; p_settings: Partial<RoomSettings> };
        Returns: { success: boolean };
      };
    };
  };
};
