-- 001_mister_white_clean.sql
-- Clean rebuild: schema, enums, indexes, realtime, seed, all RPC functions.
-- Replaces all prior migrations. Run on a clean DB or one being reset.

-- =========================================================================
-- SECTION 1 — DROP EVERYTHING IN PUBLIC SCHEMA
-- =========================================================================

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT typname FROM pg_type
    WHERE typnamespace = 'public'::regnamespace AND typtype = 'e'
  ) LOOP
    EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
  END LOOP;
END $$;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT proname, oid, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
  END LOOP;
END $$;

-- =========================================================================
-- SECTION 2 — ENUMS
-- =========================================================================

CREATE TYPE room_status AS ENUM ('waiting', 'reconfiguring', 'playing', 'finished');

CREATE TYPE game_phase AS ENUM (
  'tutorial', 'category_vote', 'role_reveal',
  'hinting', 'voting', 'elimination_reveal', 'game_over'
);

-- =========================================================================
-- SECTION 3 — TABLES
-- =========================================================================

CREATE TABLE rooms (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   VARCHAR(4) UNIQUE NOT NULL,
  status                 room_status NOT NULL DEFAULT 'waiting',
  host_player_id         UUID,
  current_turn_player_id UUID,
  phase                  game_phase,
  game_state             JSONB NOT NULL DEFAULT '{}',
  settings               JSONB NOT NULL DEFAULT '{}',
  version                INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE room_players (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name         VARCHAR(32) NOT NULL,
  is_alive     BOOLEAN NOT NULL DEFAULT TRUE,
  order_index  INTEGER,
  is_host      BOOLEAN NOT NULL DEFAULT FALSE,
  connected    BOOLEAN NOT NULL DEFAULT TRUE,
  ready        BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_name_per_room UNIQUE (room_id, name)
);

CREATE TABLE game_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  winner     VARCHAR(16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at   TIMESTAMPTZ
);

CREATE TABLE leaderboard (
  player_name VARCHAR(32) PRIMARY KEY,
  total_wins  INTEGER NOT NULL DEFAULT 0,
  total_games INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE word_bank (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(64) NOT NULL,
  word     VARCHAR(64) NOT NULL,
  CONSTRAINT unique_word_per_category UNIQUE (category, word)
);

-- =========================================================================
-- SECTION 4 — INDEXES
-- =========================================================================

CREATE UNIQUE INDEX idx_rooms_code         ON rooms(code);
CREATE        INDEX idx_rooms_status       ON rooms(status);
CREATE        INDEX idx_room_players_room  ON room_players(room_id);
CREATE        INDEX idx_room_players_name  ON room_players(room_id, name);
CREATE        INDEX idx_game_sessions_room ON game_sessions(room_id);

-- =========================================================================
-- SECTION 5 — TRIGGER: auto-update updated_at
-- =========================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =========================================================================
-- SECTION 6 — DISABLE RLS (MVP only)
-- =========================================================================

ALTER TABLE rooms         DISABLE ROW LEVEL SECURITY;
ALTER TABLE room_players  DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard   DISABLE ROW LEVEL SECURITY;
ALTER TABLE word_bank     DISABLE ROW LEVEL SECURITY;

-- =========================================================================
-- SECTION 7 — REALTIME
-- =========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_players;

-- =========================================================================
-- SECTION 8 — SEED WORD BANK (5 categories x 10 words)
-- =========================================================================

INSERT INTO word_bank (category, word) VALUES
  ('Fruits','Apple'),('Fruits','Banana'),('Fruits','Mango'),
  ('Fruits','Strawberry'),('Fruits','Watermelon'),('Fruits','Pineapple'),
  ('Fruits','Grapes'),('Fruits','Peach'),('Fruits','Cherry'),('Fruits','Lemon'),
  ('Animals','Elephant'),('Animals','Tiger'),('Animals','Dolphin'),
  ('Animals','Penguin'),('Animals','Giraffe'),('Animals','Kangaroo'),
  ('Animals','Crocodile'),('Animals','Parrot'),('Animals','Cheetah'),('Animals','Jellyfish'),
  ('Sports','Basketball'),('Sports','Swimming'),('Sports','Tennis'),
  ('Sports','Volleyball'),('Sports','Skateboarding'),('Sports','Boxing'),
  ('Sports','Archery'),('Sports','Cycling'),('Sports','Gymnastics'),('Sports','Surfing'),
  ('Food','Pizza'),('Food','Sushi'),('Food','Tacos'),
  ('Food','Ramen'),('Food','Burger'),('Food','Pasta'),
  ('Food','Dumplings'),('Food','Pancakes'),('Food','Curry'),('Food','Fried Chicken'),
  ('Places','Library'),('Places','Airport'),('Places','Hospital'),
  ('Places','Beach'),('Places','Museum'),('Places','Gym'),
  ('Places','Supermarket'),('Places','Cinema'),('Places','Restaurant'),('Places','School');

-- =========================================================================
-- SECTION 9 — RPC FUNCTIONS
-- =========================================================================

-- ----- generate_room_code ------------------------------------------------

CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS VARCHAR(4) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code VARCHAR(4);
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..4 LOOP
      v_code := v_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM rooms WHERE rooms.code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- ----- create_room -------------------------------------------------------

CREATE OR REPLACE FUNCTION create_room(
  p_host_name VARCHAR(32),
  p_settings JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_room_id   UUID;
  v_player_id UUID;
  v_code      VARCHAR(4);
  v_defaults  JSONB;
BEGIN
  v_defaults := jsonb_build_object(
    'hint_timer', 30,
    'vote_timer', 60,
    'min_players', 5,
    'max_players', 20,
    'rounds_before_voting', 1,
    'eliminations_per_vote', 1
  );
  p_settings := v_defaults || COALESCE(p_settings, '{}'::jsonb);

  IF (p_settings->>'min_players')::int < 5 THEN
    RAISE EXCEPTION 'min_players cannot be less than 5';
  END IF;
  IF (p_settings->>'max_players')::int > 20 THEN
    RAISE EXCEPTION 'max_players cannot exceed 20';
  END IF;
  IF (p_settings->>'min_players')::int > (p_settings->>'max_players')::int THEN
    RAISE EXCEPTION 'min_players cannot exceed max_players';
  END IF;

  v_code := generate_room_code();

  INSERT INTO rooms (code, status, settings, game_state)
  VALUES (v_code, 'waiting', p_settings, '{}')
  RETURNING id INTO v_room_id;

  INSERT INTO room_players (room_id, name, is_host, connected)
  VALUES (v_room_id, p_host_name, TRUE, TRUE)
  RETURNING id INTO v_player_id;

  UPDATE rooms SET host_player_id = v_player_id WHERE id = v_room_id;

  RETURN jsonb_build_object('room_id', v_room_id, 'player_id', v_player_id, 'code', v_code);
END;
$$ LANGUAGE plpgsql;

-- ----- join_room ---------------------------------------------------------

CREATE OR REPLACE FUNCTION join_room(
  p_code VARCHAR(4),
  p_player_name VARCHAR(32)
)
RETURNS JSONB AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_player_id UUID;
  v_player_count INTEGER;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE code = UPPER(p_code);
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

  IF v_room.status NOT IN ('waiting', 'reconfiguring') THEN
    RAISE EXCEPTION 'Room is not accepting players';
  END IF;

  SELECT COUNT(*) INTO v_player_count FROM room_players WHERE room_id = v_room.id;
  IF v_player_count >= (v_room.settings->>'max_players')::int THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  SELECT id INTO v_player_id FROM room_players
  WHERE room_id = v_room.id AND name = p_player_name;

  IF FOUND THEN
    UPDATE room_players SET connected = TRUE, last_seen_at = NOW() WHERE id = v_player_id;
  ELSE
    INSERT INTO room_players (room_id, name, is_host, connected)
    VALUES (v_room.id, p_player_name, FALSE, TRUE)
    RETURNING id INTO v_player_id;
  END IF;

  RETURN jsonb_build_object(
    'room_id', v_room.id,
    'player_id', v_player_id,
    'code', v_room.code,
    'status', v_room.status,
    'phase', v_room.phase,
    'settings', v_room.settings,
    'game_state', v_room.game_state
  );
END;
$$ LANGUAGE plpgsql;

-- ----- update_room_settings ----------------------------------------------

CREATE OR REPLACE FUNCTION update_room_settings(
  p_room_id UUID,
  p_player_id UUID,
  p_settings JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_room rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.host_player_id != p_player_id THEN RAISE EXCEPTION 'Only host can update settings'; END IF;
  IF v_room.status NOT IN ('waiting', 'reconfiguring') THEN
    RAISE EXCEPTION 'Cannot update settings during game';
  END IF;

  UPDATE rooms
  SET settings = v_room.settings || p_settings, version = version + 1
  WHERE id = p_room_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- ----- handle_start_game -------------------------------------------------

CREATE OR REPLACE FUNCTION handle_start_game(v_room rooms, v_player room_players)
RETURNS JSONB AS $$
DECLARE
  v_player_count  INTEGER;
  v_player_record room_players%ROWTYPE;
  v_order         INTEGER := 0;
  v_categories    TEXT[];
  v_players_array JSONB := '[]';
BEGIN
  IF v_room.status NOT IN ('waiting', 'reconfiguring') THEN
    RAISE EXCEPTION 'Game already in progress';
  END IF;
  IF v_room.host_player_id != v_player.id THEN
    RAISE EXCEPTION 'Only host can start the game';
  END IF;

  SELECT COUNT(*) INTO v_player_count FROM room_players WHERE room_id = v_room.id;
  IF v_player_count < (v_room.settings->>'min_players')::int THEN
    RAISE EXCEPTION 'Not enough players to start';
  END IF;

  FOR v_player_record IN
    SELECT * FROM room_players WHERE room_id = v_room.id ORDER BY random()
  LOOP
    UPDATE room_players SET order_index = v_order WHERE id = v_player_record.id;
    v_players_array := v_players_array || jsonb_build_object(
      'id', v_player_record.id,
      'name', v_player_record.name,
      'role', 'civilian',
      'word', NULL,
      'alive', TRUE,
      'order_index', v_order,
      'acknowledged', FALSE,
      'ready', FALSE
    );
    v_order := v_order + 1;
  END LOOP;

  SELECT ARRAY(
    SELECT DISTINCT category FROM word_bank ORDER BY random() LIMIT 4
  ) INTO v_categories;

  UPDATE rooms SET
    status = 'playing',
    phase = 'tutorial',
    game_state = jsonb_build_object(
      'round', 1,
      'category', NULL,
      'word', NULL,
      'category_options', to_jsonb(v_categories),
      'category_votes', '[]',
      'players', v_players_array,
      'hints', '[]',
      'votes', '[]',
      'ready_players', '[]',
      'acknowledged_players', '[]',
      'winner', NULL,
      'current_hint_round', 1
    ),
    current_turn_player_id = NULL,
    version = version + 1
  WHERE id = v_room.id;

  RETURN jsonb_build_object('success', true, 'phase', 'tutorial');
END;
$$ LANGUAGE plpgsql;

-- ----- handle_player_ready -----------------------------------------------

CREATE OR REPLACE FUNCTION handle_player_ready(v_room rooms, v_player room_players)
RETURNS JSONB AS $$
DECLARE
  v_ready_players JSONB;
  v_total_players INTEGER;
  v_ready_count   INTEGER;
BEGIN
  IF v_room.phase != 'tutorial' THEN RAISE EXCEPTION 'Not in tutorial phase'; END IF;

  v_ready_players := v_room.game_state->'ready_players';
  IF v_ready_players @> to_jsonb(v_player.id::text) THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  v_ready_players := v_ready_players || to_jsonb(v_player.id::text);
  SELECT COUNT(*) INTO v_total_players FROM room_players WHERE room_id = v_room.id;
  v_ready_count := jsonb_array_length(v_ready_players);

  IF v_ready_count >= v_total_players THEN
    UPDATE rooms SET
      phase = 'category_vote',
      game_state = game_state
        || jsonb_build_object('ready_players', v_ready_players)
        || jsonb_build_object('category_vote_started_at', extract(epoch from now())::bigint),
      version = version + 1
    WHERE id = v_room.id;
  ELSE
    UPDATE rooms SET
      game_state = game_state || jsonb_build_object('ready_players', v_ready_players),
      version = version + 1
    WHERE id = v_room.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'ready_count', v_ready_count, 'total', v_total_players);
END;
$$ LANGUAGE plpgsql;

-- ----- handle_resolve_category_vote (no host check) ----------------------

CREATE OR REPLACE FUNCTION handle_resolve_category_vote(v_room rooms, v_player room_players)
RETURNS JSONB AS $$
DECLARE
  v_category_votes   JSONB;
  v_winning_category TEXT;
  v_winning_word     TEXT;
  v_players          JSONB;
  v_mr_white_index   INTEGER;
  v_player_count     INTEGER;
  v_updated_players  JSONB := '[]';
  v_player_entry     JSONB;
BEGIN
  IF v_room.phase != 'category_vote' THEN RAISE EXCEPTION 'Not in category vote phase'; END IF;

  v_category_votes := v_room.game_state->'category_votes';

  SELECT category INTO v_winning_category
  FROM (
    SELECT value->>'category' AS category, COUNT(*) AS cnt
    FROM jsonb_array_elements(v_category_votes)
    GROUP BY category
    ORDER BY cnt DESC, random()
    LIMIT 1
  ) ranked;

  IF v_winning_category IS NULL THEN
    SELECT value INTO v_winning_category
    FROM jsonb_array_elements_text(v_room.game_state->'category_options')
    ORDER BY random() LIMIT 1;
  END IF;

  SELECT word INTO v_winning_word FROM word_bank
  WHERE category = v_winning_category
  ORDER BY random() LIMIT 1;

  v_players := v_room.game_state->'players';
  v_player_count := jsonb_array_length(v_players);
  v_mr_white_index := floor(random() * v_player_count)::int;

  FOR i IN 0..(v_player_count - 1) LOOP
    v_player_entry := v_players->i;
    IF i = v_mr_white_index THEN
      v_player_entry := v_player_entry || jsonb_build_object('role', 'mr_white', 'word', NULL);
    ELSE
      v_player_entry := v_player_entry || jsonb_build_object('role', 'civilian', 'word', v_winning_word);
    END IF;
    v_updated_players := v_updated_players || v_player_entry;
  END LOOP;

  UPDATE rooms SET
    phase = 'role_reveal',
    game_state = game_state || jsonb_build_object(
      'category', v_winning_category,
      'word', v_winning_word,
      'players', v_updated_players,
      'acknowledged_players', '[]'
    ),
    version = version + 1
  WHERE id = v_room.id;

  RETURN jsonb_build_object('success', true, 'winning_category', v_winning_category);
END;
$$ LANGUAGE plpgsql;

-- ----- handle_vote_category ----------------------------------------------

CREATE OR REPLACE FUNCTION handle_vote_category(v_room rooms, v_player room_players, p_payload JSONB)
RETURNS JSONB AS $$
DECLARE
  v_category       TEXT;
  v_category_votes JSONB;
  v_total_players  INTEGER;
  v_vote_count     INTEGER;
  v_fresh_room     rooms%ROWTYPE;
BEGIN
  IF v_room.phase != 'category_vote' THEN RAISE EXCEPTION 'Not in category vote phase'; END IF;

  v_category := p_payload->>'category';
  IF v_category IS NULL THEN RAISE EXCEPTION 'Category required'; END IF;

  IF NOT (v_room.game_state->'category_options') @> to_jsonb(v_category) THEN
    RAISE EXCEPTION 'Invalid category selection';
  END IF;

  v_category_votes := v_room.game_state->'category_votes';

  SELECT COALESCE(jsonb_agg(val), '[]'::jsonb) INTO v_category_votes
  FROM jsonb_array_elements(v_category_votes) val
  WHERE val->>'player_id' != v_player.id::text;

  v_category_votes := v_category_votes || jsonb_build_object(
    'player_id', v_player.id, 'category', v_category
  );

  SELECT COUNT(*) INTO v_total_players FROM room_players WHERE room_id = v_room.id;
  v_vote_count := jsonb_array_length(v_category_votes);

  UPDATE rooms SET
    game_state = game_state || jsonb_build_object('category_votes', v_category_votes),
    version = version + 1
  WHERE id = v_room.id;

  IF v_vote_count >= v_total_players THEN
    SELECT * INTO v_fresh_room FROM rooms WHERE id = v_room.id;
    PERFORM handle_resolve_category_vote(v_fresh_room, v_player);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- ----- handle_player_got_it ----------------------------------------------

CREATE OR REPLACE FUNCTION handle_player_got_it(v_room rooms, v_player room_players)
RETURNS JSONB AS $$
DECLARE
  v_ack_players     JSONB;
  v_total_players   INTEGER;
  v_ack_count       INTEGER;
  v_first_player_id UUID;
BEGIN
  IF v_room.phase != 'role_reveal' THEN RAISE EXCEPTION 'Not in role reveal phase'; END IF;

  v_ack_players := v_room.game_state->'acknowledged_players';
  IF v_ack_players @> to_jsonb(v_player.id::text) THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  v_ack_players := v_ack_players || to_jsonb(v_player.id::text);
  SELECT COUNT(*) INTO v_total_players FROM room_players WHERE room_id = v_room.id;
  v_ack_count := jsonb_array_length(v_ack_players);

  IF v_ack_count >= v_total_players THEN
    SELECT (value->>'id')::UUID INTO v_first_player_id
    FROM jsonb_array_elements(v_room.game_state->'players')
    WHERE (value->>'alive')::boolean = TRUE
    ORDER BY (value->>'order_index')::int ASC
    LIMIT 1;

    UPDATE rooms SET
      phase = 'hinting',
      current_turn_player_id = v_first_player_id,
      game_state = game_state || jsonb_build_object(
        'acknowledged_players', v_ack_players,
        'hint_turn_started_at', extract(epoch from now())::bigint,
        'current_hint_round', 1
      ),
      version = version + 1
    WHERE id = v_room.id;
  ELSE
    UPDATE rooms SET
      game_state = game_state || jsonb_build_object('acknowledged_players', v_ack_players),
      version = version + 1
    WHERE id = v_room.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'ack_count', v_ack_count, 'total', v_total_players);
END;
$$ LANGUAGE plpgsql;

-- ----- handle_submit_hint ------------------------------------------------

CREATE OR REPLACE FUNCTION handle_submit_hint(v_room rooms, v_player room_players, p_payload JSONB)
RETURNS JSONB AS $$
DECLARE
  v_hint                  TEXT;
  v_hints                 JSONB;
  v_alive_players         JSONB;
  v_next_player_id        UUID;
  v_hints_this_round      INTEGER;
  v_alive_count           INTEGER;
  v_current_hint_round    INTEGER;
  v_rounds_before_voting  INTEGER;
BEGIN
  IF v_room.phase != 'hinting' THEN RAISE EXCEPTION 'Not in hinting phase'; END IF;
  IF v_room.current_turn_player_id != v_player.id THEN RAISE EXCEPTION 'Not your turn'; END IF;

  v_hint := NULLIF(TRIM(p_payload->>'hint'), '');
  v_hints := v_room.game_state->'hints';
  v_current_hint_round := (v_room.game_state->>'current_hint_round')::int;
  v_rounds_before_voting := (v_room.settings->>'rounds_before_voting')::int;

  v_hints := v_hints || jsonb_build_object(
    'player_id', v_player.id,
    'player_name', v_player.name,
    'hint', v_hint,
    'round', v_current_hint_round,
    'submitted_at', extract(epoch from now())::bigint
  );

  SELECT jsonb_agg(value ORDER BY (value->>'order_index')::int ASC)
  INTO v_alive_players
  FROM jsonb_array_elements(v_room.game_state->'players')
  WHERE (value->>'alive')::boolean = TRUE;

  v_alive_count := jsonb_array_length(v_alive_players);

  SELECT COUNT(*) INTO v_hints_this_round
  FROM jsonb_array_elements(v_hints)
  WHERE (value->>'round')::int = v_current_hint_round;

  SELECT (value->>'id')::UUID INTO v_next_player_id
  FROM jsonb_array_elements(v_alive_players)
  WHERE (value->>'order_index')::int > (
    SELECT (value->>'order_index')::int
    FROM jsonb_array_elements(v_alive_players)
    WHERE value->>'id' = v_player.id::text
  )
  ORDER BY (value->>'order_index')::int ASC
  LIMIT 1;

  IF v_hints_this_round >= v_alive_count THEN
    IF v_current_hint_round >= v_rounds_before_voting THEN
      UPDATE rooms SET
        phase = 'voting',
        current_turn_player_id = NULL,
        game_state = game_state || jsonb_build_object(
          'hints', v_hints,
          'votes', '[]',
          'voting_phase_started_at', extract(epoch from now())::bigint
        ),
        version = version + 1
      WHERE id = v_room.id;
      RETURN jsonb_build_object('success', true, 'next_phase', 'voting');
    ELSE
      SELECT (value->>'id')::UUID INTO v_next_player_id
      FROM jsonb_array_elements(v_alive_players)
      ORDER BY (value->>'order_index')::int ASC
      LIMIT 1;

      UPDATE rooms SET
        current_turn_player_id = v_next_player_id,
        game_state = game_state || jsonb_build_object(
          'hints', v_hints,
          'current_hint_round', v_current_hint_round + 1,
          'hint_turn_started_at', extract(epoch from now())::bigint
        ),
        version = version + 1
      WHERE id = v_room.id;
    END IF;
  ELSE
    UPDATE rooms SET
      current_turn_player_id = v_next_player_id,
      game_state = game_state || jsonb_build_object(
        'hints', v_hints,
        'hint_turn_started_at', extract(epoch from now())::bigint
      ),
      version = version + 1
    WHERE id = v_room.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- ----- handle_skip_hint --------------------------------------------------

CREATE OR REPLACE FUNCTION handle_skip_hint(v_room rooms, v_player room_players)
RETURNS JSONB AS $$
DECLARE
  v_hint_started_at BIGINT;
  v_hint_timer      INTEGER;
  v_elapsed         BIGINT;
  v_current_player  room_players%ROWTYPE;
BEGIN
  IF v_room.phase != 'hinting' THEN RAISE EXCEPTION 'Not in hinting phase'; END IF;

  v_hint_started_at := (v_room.game_state->>'hint_turn_started_at')::bigint;
  v_hint_timer := (v_room.settings->>'hint_timer')::int;
  v_elapsed := extract(epoch from now())::bigint - v_hint_started_at;

  IF v_elapsed < v_hint_timer THEN
    RAISE EXCEPTION 'Timer has not expired yet';
  END IF;

  SELECT * INTO v_current_player FROM room_players WHERE id = v_room.current_turn_player_id;
  RETURN handle_submit_hint(v_room, v_current_player, jsonb_build_object('hint', NULL));
END;
$$ LANGUAGE plpgsql;

-- ----- handle_vote -------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_vote(v_room rooms, v_player room_players, p_payload JSONB)
RETURNS JSONB AS $$
DECLARE
  v_target_id UUID;
  v_votes     JSONB;
BEGIN
  IF v_room.phase != 'voting' THEN RAISE EXCEPTION 'Not in voting phase'; END IF;
  IF NOT v_player.is_alive THEN RAISE EXCEPTION 'Dead players cannot vote'; END IF;

  v_target_id := (p_payload->>'target_id')::UUID;

  IF v_target_id IS NOT NULL THEN
    IF v_target_id = v_player.id THEN RAISE EXCEPTION 'Cannot vote for yourself'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_room.game_state->'players')
      WHERE (value->>'id')::UUID = v_target_id AND (value->>'alive')::boolean = TRUE
    ) THEN
      RAISE EXCEPTION 'Target player is not alive';
    END IF;
  END IF;

  v_votes := v_room.game_state->'votes';

  SELECT COALESCE(jsonb_agg(val), '[]'::jsonb) INTO v_votes
  FROM jsonb_array_elements(v_votes) val
  WHERE (val->>'voter_id')::UUID != v_player.id;

  v_votes := v_votes || jsonb_build_object(
    'voter_id', v_player.id,
    'target_id', v_target_id,
    'voted_at', extract(epoch from now())::bigint
  );

  UPDATE rooms SET
    game_state = game_state || jsonb_build_object('votes', v_votes),
    version = version + 1
  WHERE id = v_room.id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- ----- handle_resolve_vote (leaderboard fix included) --------------------

CREATE OR REPLACE FUNCTION handle_resolve_vote(v_room rooms, v_player room_players)
RETURNS JSONB AS $$
DECLARE
  v_eliminations_per_vote INTEGER;
  v_votes                 JSONB;
  v_players               JSONB;
  v_eliminated_ids        UUID[];
  v_alive_civilians       INTEGER;
  v_mr_white_alive        BOOLEAN;
  v_winner                TEXT;
  v_updated_players       JSONB := '[]';
  v_player_entry          JSONB;
  v_eliminated_info       JSONB := '[]';
BEGIN
  IF v_room.phase != 'voting' THEN RAISE EXCEPTION 'Not in voting phase'; END IF;
  IF v_room.host_player_id != v_player.id THEN RAISE EXCEPTION 'Only host resolves vote'; END IF;

  v_eliminations_per_vote := (v_room.settings->>'eliminations_per_vote')::int;
  v_votes := v_room.game_state->'votes';
  v_players := v_room.game_state->'players';

  SELECT ARRAY(
    SELECT (value->>'target_id')::UUID
    FROM jsonb_array_elements(v_votes)
    WHERE value->>'target_id' IS NOT NULL
    GROUP BY value->>'target_id'
    ORDER BY COUNT(*) DESC, random()
    LIMIT v_eliminations_per_vote
  ) INTO v_eliminated_ids;

  IF array_length(v_eliminated_ids, 1) IS NULL THEN
    SELECT ARRAY[(
      SELECT (value->>'id')::UUID
      FROM jsonb_array_elements(v_players)
      WHERE (value->>'alive')::boolean = TRUE
      ORDER BY random() LIMIT 1
    )] INTO v_eliminated_ids;
  END IF;

  FOR i IN 0..(jsonb_array_length(v_players) - 1) LOOP
    v_player_entry := v_players->i;
    IF (v_player_entry->>'id')::UUID = ANY(v_eliminated_ids) THEN
      v_player_entry := v_player_entry || jsonb_build_object('alive', FALSE);
      v_eliminated_info := v_eliminated_info || jsonb_build_object(
        'id', v_player_entry->>'id',
        'name', v_player_entry->>'name',
        'role', v_player_entry->>'role',
        'word', v_player_entry->>'word'
      );
    END IF;
    v_updated_players := v_updated_players || v_player_entry;
  END LOOP;

  UPDATE room_players SET is_alive = FALSE WHERE id = ANY(v_eliminated_ids);

  SELECT COUNT(*) INTO v_alive_civilians
  FROM jsonb_array_elements(v_updated_players)
  WHERE (value->>'alive')::boolean = TRUE AND value->>'role' = 'civilian';

  SELECT EXISTS(
    SELECT 1 FROM jsonb_array_elements(v_updated_players)
    WHERE (value->>'alive')::boolean = TRUE AND value->>'role' = 'mr_white'
  ) INTO v_mr_white_alive;

  IF NOT v_mr_white_alive THEN
    v_winner := 'civilians';
  ELSIF v_alive_civilians <= 1 THEN
    v_winner := 'mr_white';
  END IF;

  IF v_winner IS NOT NULL THEN
    UPDATE rooms SET
      phase = 'game_over',
      status = 'finished',
      game_state = game_state || jsonb_build_object(
        'players', v_updated_players,
        'eliminated_this_round', v_eliminated_info,
        'winner', v_winner
      ),
      version = version + 1
    WHERE id = v_room.id;

    INSERT INTO game_sessions (room_id, winner, ended_at)
    VALUES (v_room.id, v_winner, NOW());

    INSERT INTO leaderboard (player_name, total_wins, total_games)
    SELECT
      rp.name,
      CASE
        WHEN v_winner = 'civilians' AND rp.is_alive THEN 1
        WHEN v_winner = 'mr_white'  AND rp.is_alive THEN 1
        ELSE 0
      END,
      1
    FROM room_players rp
    WHERE rp.room_id = v_room.id
    ON CONFLICT (player_name) DO UPDATE SET
      total_wins  = leaderboard.total_wins  + EXCLUDED.total_wins,
      total_games = leaderboard.total_games + 1,
      updated_at  = NOW();

    RETURN jsonb_build_object('success', true, 'winner', v_winner, 'phase', 'game_over');
  ELSE
    UPDATE rooms SET
      phase = 'elimination_reveal',
      game_state = game_state || jsonb_build_object(
        'players', v_updated_players,
        'eliminated_this_round', v_eliminated_info
      ),
      version = version + 1
    WHERE id = v_room.id;

    RETURN jsonb_build_object('success', true, 'phase', 'elimination_reveal');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ----- handle_next_round -------------------------------------------------

CREATE OR REPLACE FUNCTION handle_next_round(v_room rooms, v_player room_players)
RETURNS JSONB AS $$
DECLARE
  v_first_player_id UUID;
BEGIN
  IF v_room.phase != 'elimination_reveal' THEN RAISE EXCEPTION 'Not in elimination reveal phase'; END IF;
  IF v_room.host_player_id != v_player.id THEN RAISE EXCEPTION 'Only host can advance to next round'; END IF;

  SELECT (value->>'id')::UUID INTO v_first_player_id
  FROM jsonb_array_elements(v_room.game_state->'players')
  WHERE (value->>'alive')::boolean = TRUE
  ORDER BY (value->>'order_index')::int ASC
  LIMIT 1;

  UPDATE rooms SET
    phase = 'hinting',
    current_turn_player_id = v_first_player_id,
    game_state = game_state || jsonb_build_object(
      'hints', '[]',
      'votes', '[]',
      'round', (game_state->>'round')::int + 1,
      'current_hint_round', 1,
      'eliminated_this_round', '[]',
      'hint_turn_started_at', extract(epoch from now())::bigint
    ),
    version = version + 1
  WHERE id = v_room.id;

  RETURN jsonb_build_object('success', true, 'phase', 'hinting');
END;
$$ LANGUAGE plpgsql;

-- ----- handle_action (dispatcher) ----------------------------------------

CREATE OR REPLACE FUNCTION handle_action(
  p_room_id UUID,
  p_player_id UUID,
  p_action_type VARCHAR(32),
  p_payload JSONB,
  p_expected_version INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_room   rooms%ROWTYPE;
  v_player room_players%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

  IF v_room.version != p_expected_version THEN
    RAISE EXCEPTION 'Version mismatch. Refresh and retry.';
  END IF;

  SELECT * INTO v_player FROM room_players WHERE id = p_player_id AND room_id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found in room'; END IF;

  CASE p_action_type
    WHEN 'START_GAME'            THEN RETURN handle_start_game(v_room, v_player);
    WHEN 'PLAYER_READY'          THEN RETURN handle_player_ready(v_room, v_player);
    WHEN 'VOTE_CATEGORY'         THEN RETURN handle_vote_category(v_room, v_player, p_payload);
    WHEN 'RESOLVE_CATEGORY_VOTE' THEN RETURN handle_resolve_category_vote(v_room, v_player);
    WHEN 'PLAYER_GOT_IT'         THEN RETURN handle_player_got_it(v_room, v_player);
    WHEN 'SUBMIT_HINT'           THEN RETURN handle_submit_hint(v_room, v_player, p_payload);
    WHEN 'SKIP_HINT'             THEN RETURN handle_skip_hint(v_room, v_player);
    WHEN 'VOTE'                  THEN RETURN handle_vote(v_room, v_player, p_payload);
    WHEN 'RESOLVE_VOTE'          THEN RETURN handle_resolve_vote(v_room, v_player);
    WHEN 'NEXT_ROUND'            THEN RETURN handle_next_round(v_room, v_player);
    ELSE RAISE EXCEPTION 'Unknown action type: %', p_action_type;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ----- play_again --------------------------------------------------------

CREATE OR REPLACE FUNCTION play_again(p_room_id UUID, p_player_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_room rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.host_player_id != p_player_id THEN RAISE EXCEPTION 'Only host can restart'; END IF;
  IF v_room.phase != 'game_over' THEN RAISE EXCEPTION 'Game is not over'; END IF;

  UPDATE room_players SET is_alive = TRUE, order_index = NULL, ready = FALSE
  WHERE room_id = p_room_id;

  UPDATE rooms SET
    status = 'reconfiguring',
    phase = NULL,
    game_state = '{}',
    current_turn_player_id = NULL,
    version = version + 1
  WHERE id = p_room_id;

  RETURN jsonb_build_object('success', true, 'status', 'reconfiguring');
END;
$$ LANGUAGE plpgsql;

-- ----- finish_reconfigure ------------------------------------------------
-- Host finishes editing settings on Play Again → flip room back to waiting

CREATE OR REPLACE FUNCTION finish_reconfigure(p_room_id UUID, p_player_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_room rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.host_player_id != p_player_id THEN RAISE EXCEPTION 'Only host can finish reconfigure'; END IF;
  IF v_room.status != 'reconfiguring' THEN RAISE EXCEPTION 'Room is not in reconfiguring state'; END IF;

  UPDATE rooms SET status = 'waiting', version = version + 1 WHERE id = p_room_id;

  RETURN jsonb_build_object('success', true, 'status', 'waiting');
END;
$$ LANGUAGE plpgsql;

-- ----- player_disconnect / player_reconnect ------------------------------

CREATE OR REPLACE FUNCTION player_disconnect(p_player_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE room_players SET connected = FALSE, last_seen_at = NOW()
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION player_reconnect(
  p_room_code VARCHAR(4),
  p_player_name VARCHAR(32)
)
RETURNS JSONB AS $$
DECLARE
  v_room   rooms%ROWTYPE;
  v_player room_players%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE code = UPPER(p_room_code);
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

  SELECT * INTO v_player FROM room_players
  WHERE room_id = v_room.id AND name = p_player_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;

  UPDATE room_players SET connected = TRUE, last_seen_at = NOW()
  WHERE id = v_player.id;

  RETURN jsonb_build_object(
    'room_id', v_room.id,
    'player_id', v_player.id,
    'status', v_room.status,
    'phase', v_room.phase,
    'game_state', v_room.game_state,
    'settings', v_room.settings,
    'is_host', v_player.is_host,
    'is_alive', v_player.is_alive
  );
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- END OF MIGRATION
-- =========================================================================
