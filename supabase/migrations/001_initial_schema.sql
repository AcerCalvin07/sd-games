-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting | playing | finished
  host_player_id UUID NOT NULL,
  current_turn_player_id UUID,
  phase TEXT DEFAULT 'waiting', -- role_assignment | hinting | voting | elimination | finished
  game_state JSONB NOT NULL DEFAULT '{}',
  version INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Players table
CREATE TABLE room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_alive BOOLEAN DEFAULT TRUE,
  order_index INT,
  is_host BOOLEAN DEFAULT FALSE,
  connected BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, name)
);

-- Game sessions (for leaderboard)
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  winner TEXT NOT NULL, -- winning team: 'civilians' | 'mr_white'
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- Leaderboard
CREATE TABLE leaderboard (
  player_name TEXT PRIMARY KEY,
  total_wins INT DEFAULT 0,
  total_games INT DEFAULT 0
);

-- Create indexes
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_room_players_room_id ON room_players(room_id);
CREATE INDEX idx_game_sessions_room_id ON game_sessions(room_id);