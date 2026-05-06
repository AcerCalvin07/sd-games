-- 005_drop_version_lock_and_fix_all_skip.sql
--
-- Two fixes:
--
-- 1. Version mismatch race condition.
--    handle_action checked v_room.version != p_expected_version and threw on
--    mismatch. With realtime updates arriving asynchronously, clients regularly
--    held a slightly stale version when their click landed at the server,
--    producing spurious errors. The first click failed; the second (with fresh
--    state) succeeded.
--
--    The optimistic version check was redundant safety. handle_action already
--    holds a FOR UPDATE row lock on the room; concurrent actions are serialized
--    at the DB level, and per-action validation (phase, turn, alive) prevents
--    invalid mutations. We keep the row lock; we drop the version check.
--
--    Version is still incremented on every mutation so realtime payloads carry
--    a monotonic counter (useful for debugging and future use), but no client
--    request is rejected for stale version.
--
-- 2. All-skip in voting phase used to eliminate a random alive player.
--    Desired behavior: if every voter skipped, no one is eliminated. The game
--    loops straight back to hinting (round + 1, hints/votes reset).
--    No elimination_reveal phase, no winner check needed (no one died).
--
-- Idempotent: CREATE OR REPLACE on both functions.

-- =========================================================================
-- handle_action — drop version mismatch check, keep row lock
-- =========================================================================

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
  -- Row lock prevents concurrent mutations on the same room.
  -- p_expected_version is now informational only (not enforced) so realtime
  -- lag does not produce spurious "Version mismatch" errors at the UI.
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

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

-- =========================================================================
-- handle_resolve_vote — all-skip = no elimination, loop back to hinting
-- =========================================================================

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
  v_updated_players       JSONB := '[]'::jsonb;
  v_player_entry          JSONB;
  v_eliminated_info       JSONB := '[]'::jsonb;
  v_first_player_id       UUID;
BEGIN
  IF v_room.phase != 'voting' THEN RAISE EXCEPTION 'Not in voting phase'; END IF;
  IF v_room.host_player_id != v_player.id THEN RAISE EXCEPTION 'Only host resolves vote'; END IF;

  v_eliminations_per_vote := (v_room.settings->>'eliminations_per_vote')::int;
  v_votes := v_room.game_state->'votes';
  v_players := v_room.game_state->'players';

  -- Top N voted players (excluding skips, ties broken randomly).
  SELECT ARRAY(
    SELECT (value->>'target_id')::UUID
    FROM jsonb_array_elements(v_votes)
    WHERE value->>'target_id' IS NOT NULL
    GROUP BY value->>'target_id'
    ORDER BY COUNT(*) DESC, random()
    LIMIT v_eliminations_per_vote
  ) INTO v_eliminated_ids;

  -- ALL-SKIP / NO VOTES: loop back to hinting, no elimination.
  IF array_length(v_eliminated_ids, 1) IS NULL THEN
    SELECT (value->>'id')::UUID INTO v_first_player_id
    FROM jsonb_array_elements(v_players)
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

    RETURN jsonb_build_object(
      'success',  true,
      'phase',    'hinting',
      'message',  'All players skipped — no elimination'
    );
  END IF;

  -- Normal elimination path.
  FOR i IN 0..(jsonb_array_length(v_players) - 1) LOOP
    v_player_entry := v_players->i;
    IF (v_player_entry->>'id')::UUID = ANY(v_eliminated_ids) THEN
      v_player_entry := v_player_entry || jsonb_build_object('alive', FALSE);
      v_eliminated_info := v_eliminated_info || jsonb_build_object(
        'id',   v_player_entry->>'id',
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
        'players',               v_updated_players,
        'eliminated_this_round', v_eliminated_info,
        'winner',                v_winner
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
        'players',               v_updated_players,
        'eliminated_this_round', v_eliminated_info
      ),
      version = version + 1
    WHERE id = v_room.id;

    RETURN jsonb_build_object('success', true, 'phase', 'elimination_reveal');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- END OF MIGRATION 005
-- =========================================================================
