-- 004_fix_remaining_jsonb_string_array_bugs.sql
--
-- Bug:
--   Migration 003 patched handle_start_game and handle_next_round, but missed
--   the same '[]' (text) vs '[]'::jsonb (array) bug in two other functions:
--
--     handle_resolve_category_vote → 'acknowledged_players' as string
--     handle_submit_hint           → 'votes' as string (when transitioning to voting)
--
--   The first bug bit on PLAYER_GOT_IT clicks. The second bit on submitting the
--   final hint of the round (transition to voting phase).
--
-- Fix:
--   Cast every '[]' to '[]'::jsonb inside jsonb_build_object calls in BOTH
--   functions. Then heal any rooms with non-array values in the affected fields.
--
-- Idempotent: CREATE OR REPLACE on both functions.

-- =========================================================================
-- handle_resolve_category_vote (acknowledged_players cast)
-- =========================================================================

CREATE OR REPLACE FUNCTION handle_resolve_category_vote(v_room rooms, v_player room_players)
RETURNS JSONB AS $$
DECLARE
  v_category_votes   JSONB;
  v_winning_category TEXT;
  v_winning_word     TEXT;
  v_players          JSONB;
  v_mr_white_index   INTEGER;
  v_player_count     INTEGER;
  v_updated_players  JSONB := '[]'::jsonb;
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
      'category',             v_winning_category,
      'word',                 v_winning_word,
      'players',              v_updated_players,
      'acknowledged_players', '[]'::jsonb
    ),
    version = version + 1
  WHERE id = v_room.id;

  RETURN jsonb_build_object('success', true, 'winning_category', v_winning_category);
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- handle_submit_hint (votes cast on phase transition to voting)
-- =========================================================================

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
          'hints',                   v_hints,
          'votes',                   '[]'::jsonb,
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
          'hints',                v_hints,
          'current_hint_round',   v_current_hint_round + 1,
          'hint_turn_started_at', extract(epoch from now())::bigint
        ),
        version = version + 1
      WHERE id = v_room.id;
    END IF;
  ELSE
    UPDATE rooms SET
      current_turn_player_id = v_next_player_id,
      game_state = game_state || jsonb_build_object(
        'hints',                v_hints,
        'hint_turn_started_at', extract(epoch from now())::bigint
      ),
      version = version + 1
    WHERE id = v_room.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- DATA HEAL — rooms currently in voting/role_reveal/elimination_reveal phases
-- may already have stringified votes/acknowledged_players. Coerce them to
-- arrays so existing games can finish without crashing.
-- Tighter fix than 003: handles NULL/missing keys explicitly via COALESCE
-- before checking jsonb_typeof, so no rooms slip through.
-- =========================================================================

UPDATE rooms
SET game_state = game_state || jsonb_build_object(
    'votes',
    CASE WHEN jsonb_typeof(COALESCE(game_state->'votes', 'null'::jsonb)) = 'array'
         THEN game_state->'votes'
         ELSE '[]'::jsonb END,
    'acknowledged_players',
    CASE WHEN jsonb_typeof(COALESCE(game_state->'acknowledged_players', 'null'::jsonb)) = 'array'
         THEN game_state->'acknowledged_players'
         ELSE '[]'::jsonb END,
    'ready_players',
    CASE WHEN jsonb_typeof(COALESCE(game_state->'ready_players', 'null'::jsonb)) = 'array'
         THEN game_state->'ready_players'
         ELSE '[]'::jsonb END,
    'category_votes',
    CASE WHEN jsonb_typeof(COALESCE(game_state->'category_votes', 'null'::jsonb)) = 'array'
         THEN game_state->'category_votes'
         ELSE '[]'::jsonb END,
    'hints',
    CASE WHEN jsonb_typeof(COALESCE(game_state->'hints', 'null'::jsonb)) = 'array'
         THEN game_state->'hints'
         ELSE '[]'::jsonb END,
    'eliminated_this_round',
    CASE WHEN jsonb_typeof(COALESCE(game_state->'eliminated_this_round', 'null'::jsonb)) = 'array'
         THEN game_state->'eliminated_this_round'
         ELSE '[]'::jsonb END
  )
WHERE status IN ('playing', 'finished');

-- =========================================================================
-- END OF MIGRATION 004
-- =========================================================================
