-- 002_reconnect_and_category_pick_fixes.sql
--
-- Patches two functions from 001_mister_white_clean.sql:
--
-- 1. handle_start_game()
--    Bug: 42P10 — "for SELECT DISTINCT, ORDER BY expressions must appear in select list"
--    Fix: Wrap DISTINCT in a subquery so the outer ORDER BY random() is unambiguous.
--
-- 2. player_reconnect()
--    Bug: Returned a partial room shape. Frontend reconstructed an incomplete Room
--    object missing host_player_id, current_turn_player_id, version, code, and
--    timestamps. Any optimistic-lock call broke; any component finding the host by
--    id silently failed.
--    Fix: Return the full room shape so post-reconnect state is identical to
--    post-create / post-join state.
--
-- Idempotent: uses CREATE OR REPLACE on both functions.

-- =========================================================================
-- handle_start_game (DISTINCT + ORDER BY random fix)
-- =========================================================================

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

  -- Pick 4 random distinct categories.
  -- Inner query deduplicates first, outer randomizes — avoids 42P10.
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

-- =========================================================================
-- player_reconnect (full room shape)
-- =========================================================================

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
    'room_id',                v_room.id,
    'player_id',              v_player.id,
    'code',                   v_room.code,
    'status',                 v_room.status,
    'phase',                  v_room.phase,
    'host_player_id',         v_room.host_player_id,
    'current_turn_player_id', v_room.current_turn_player_id,
    'game_state',             v_room.game_state,
    'settings',               v_room.settings,
    'version',                v_room.version,
    'created_at',             v_room.created_at,
    'updated_at',             v_room.updated_at,
    'is_host',                v_player.is_host,
    'is_alive',               v_player.is_alive
  );
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- END OF MIGRATION 002
-- =========================================================================
