-- 003_fix_jsonb_array_initialization.sql
--
-- Bug:
--   handle_start_game and handle_next_round were storing JSON arrays as JSONB
--   STRINGS ("[]") instead of JSONB ARRAYS ([]) inside game_state. The string
--   literal '[]' inside jsonb_build_object(key, value) is interpreted as a TEXT
--   value, not a JSON array. Frontend code calling .find() / .filter() / .map()
--   on these fields crashed at runtime with "o.find is not a function".
--
-- Fix:
--   Cast every empty array literal to ::jsonb so jsonb_build_object treats it
--   as a JSON array.
--
-- Affected fields in game_state:
--   category_votes, hints, votes, ready_players, acknowledged_players,
--   eliminated_this_round
--
-- Idempotent: CREATE OR REPLACE on both functions.

-- =========================================================================
-- handle_start_game (re-emit with proper JSONB array casts)
-- =========================================================================

CREATE OR REPLACE FUNCTION handle_start_game(v_room rooms, v_player room_players)
RETURNS JSONB AS $$
DECLARE
  v_player_count  INTEGER;
  v_player_record room_players%ROWTYPE;
  v_order         INTEGER := 0;
  v_categories    TEXT[];
  v_players_array JSONB := '[]'::jsonb;
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

  -- Pick 4 random distinct categories.
  SELECT ARRAY(
    SELECT category FROM (
      SELECT DISTINCT category FROM word_bank
    ) AS distinct_categories
    ORDER BY random()
    LIMIT 4
  ) INTO v_categories;

  UPDATE rooms SET
    status = 'playing',
    phase = 'tutorial',
    game_state = jsonb_build_object(
      'round',                 1,
      'category',              NULL,
      'word',                  NULL,
      'category_options',      to_jsonb(v_categories),
      'category_votes',        '[]'::jsonb,
      'players',               v_players_array,
      'hints',                 '[]'::jsonb,
      'votes',                 '[]'::jsonb,
      'ready_players',         '[]'::jsonb,
      'acknowledged_players',  '[]'::jsonb,
      'winner',                NULL,
      'current_hint_round',    1
    ),
    current_turn_player_id = NULL,
    version = version + 1
  WHERE id = v_room.id;

  RETURN jsonb_build_object('success', true, 'phase', 'tutorial');
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- handle_next_round (same array-cast fix)
-- =========================================================================

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
      'hints',                 '[]'::jsonb,
      'votes',                 '[]'::jsonb,
      'round',                 (game_state->>'round')::int + 1,
      'current_hint_round',    1,
      'eliminated_this_round', '[]'::jsonb,
      'hint_turn_started_at',  extract(epoch from now())::bigint
    ),
    version = version + 1
  WHERE id = v_room.id;

  RETURN jsonb_build_object('success', true, 'phase', 'hinting');
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- DATA HEAL — convert any existing string-typed game_state fields to arrays
-- so rooms created on the buggy version don't have to be deleted.
-- Safe on rows where the fields are already arrays (jsonb_set is a no-op
-- when type already matches via the WHERE filter).
-- =========================================================================

UPDATE rooms
SET game_state = game_state
  || jsonb_build_object(
    'category_votes',
    CASE WHEN jsonb_typeof(game_state->'category_votes') = 'array'
         THEN game_state->'category_votes'
         ELSE '[]'::jsonb END,
    'hints',
    CASE WHEN jsonb_typeof(game_state->'hints') = 'array'
         THEN game_state->'hints'
         ELSE '[]'::jsonb END,
    'votes',
    CASE WHEN jsonb_typeof(game_state->'votes') = 'array'
         THEN game_state->'votes'
         ELSE '[]'::jsonb END,
    'ready_players',
    CASE WHEN jsonb_typeof(game_state->'ready_players') = 'array'
         THEN game_state->'ready_players'
         ELSE '[]'::jsonb END,
    'acknowledged_players',
    CASE WHEN jsonb_typeof(game_state->'acknowledged_players') = 'array'
         THEN game_state->'acknowledged_players'
         ELSE '[]'::jsonb END,
    'eliminated_this_round',
    CASE WHEN jsonb_typeof(game_state->'eliminated_this_round') = 'array'
         THEN COALESCE(game_state->'eliminated_this_round', '[]'::jsonb)
         ELSE '[]'::jsonb END
  )
WHERE status IN ('playing', 'finished')
  AND (
       jsonb_typeof(game_state->'category_votes')        != 'array'
    OR jsonb_typeof(game_state->'hints')                 != 'array'
    OR jsonb_typeof(game_state->'votes')                 != 'array'
    OR jsonb_typeof(game_state->'ready_players')         != 'array'
    OR jsonb_typeof(game_state->'acknowledged_players')  != 'array'
  );

-- =========================================================================
-- END OF MIGRATION 003
-- =========================================================================
