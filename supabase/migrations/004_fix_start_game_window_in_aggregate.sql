-- Fix: "aggregate function calls cannot contain window function calls"
-- The START_GAME branch inlined ROW_NUMBER() OVER (...) inside jsonb_agg(...).
-- Postgres forbids this. Compute row numbers in a subquery, then aggregate.

CREATE OR REPLACE FUNCTION handle_action(
  p_room_id UUID,
  p_player_id UUID,
  p_action JSONB,
  p_expected_version INT
)
RETURNS JSONB AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_player room_players%ROWTYPE;
  v_action_type TEXT;
  v_payload JSONB;
  v_new_state JSONB;
  v_player_count INT;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;

  IF v_room IS NULL THEN
    RETURN jsonb_build_object('error', 'Room not found');
  END IF;

  IF v_room.version != p_expected_version THEN
    RETURN jsonb_build_object('error', 'Stale version');
  END IF;

  SELECT * INTO v_player FROM room_players
  WHERE room_id = p_room_id AND id = p_player_id;

  IF v_player IS NULL THEN
    RETURN jsonb_build_object('error', 'Player not found in room');
  END IF;

  v_action_type := p_action->>'type';
  v_payload := p_action->'payload';

  -- ============ START_GAME ============
  IF v_action_type = 'START_GAME' THEN
    IF NOT v_player.is_host THEN
      RETURN jsonb_build_object('error', 'Only host can start game');
    END IF;

    SELECT COUNT(*) INTO v_player_count FROM room_players WHERE room_id = p_room_id;

    IF v_player_count < 3 THEN
      RETURN jsonb_build_object('error', 'Need at least 3 players');
    END IF;

    IF v_room.status != 'waiting' THEN
      RETURN jsonb_build_object('error', 'Game already started');
    END IF;

    -- Randomize seating order.
    UPDATE room_players
    SET order_index = (
      SELECT row_number() OVER (ORDER BY RANDOM()) - 1
      FROM room_players rp2 WHERE rp2.id = room_players.id
    )
    WHERE room_id = p_room_id;

    -- Build players[] with role/word assigned by rank.
    -- Window function runs in the inner subquery; the outer aggregate just reads `rn`.
    v_new_state := jsonb_build_object(
      'round', 1,
      'category', 'Animal',
      'players', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id::TEXT,
            'name', t.name,
            'role', CASE WHEN t.rn = 1 THEN 'mr_white' ELSE 'civilian' END,
            'alive', TRUE,
            'word', CASE WHEN t.rn = 1 THEN NULL ELSE 'elephant' END
          )
          ORDER BY t.rn
        )
        FROM (
          SELECT rp.id, rp.name,
                 ROW_NUMBER() OVER (ORDER BY rp.order_index) AS rn
          FROM room_players rp
          WHERE rp.room_id = p_room_id
        ) t
      ),
      'hints', '[]'::jsonb,
      'votes', '[]'::jsonb
    );

    UPDATE rooms SET
      status = 'playing',
      phase = 'hinting',
      game_state = v_new_state,
      current_turn_player_id = (
        SELECT id FROM room_players
        WHERE room_id = p_room_id
        ORDER BY order_index LIMIT 1
      ),
      version = version + 1
    WHERE id = p_room_id;

    RETURN jsonb_build_object('success', TRUE, 'message', 'Game started');

  -- ============ SUBMIT_HINT ============
  ELSIF v_action_type = 'SUBMIT_HINT' THEN
    IF v_room.current_turn_player_id != p_player_id THEN
      RETURN jsonb_build_object('error', 'Not your turn');
    END IF;

    IF v_room.phase != 'hinting' THEN
      RETURN jsonb_build_object('error', 'Not in hinting phase');
    END IF;

    IF NOT v_player.is_alive THEN
      RETURN jsonb_build_object('error', 'Player is not alive');
    END IF;

    v_new_state := v_room.game_state || jsonb_build_object(
      'hints', COALESCE(v_room.game_state->'hints', '[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object(
          'player_id', p_player_id::TEXT,
          'player_name', v_player.name,
          'hint', v_payload->>'hint',
          'timestamp', TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        ))
    );

    UPDATE rooms SET
      game_state = v_new_state,
      current_turn_player_id = (
        SELECT id FROM room_players
        WHERE room_id = p_room_id AND order_index = (
          (SELECT order_index FROM room_players WHERE id = p_player_id) + 1
        ) % (SELECT COUNT(*) FROM room_players WHERE room_id = p_room_id)
      ),
      version = version + 1
    WHERE id = p_room_id;

    RETURN jsonb_build_object('success', TRUE, 'message', 'Hint submitted');

  -- ============ VOTE ============
  ELSIF v_action_type = 'VOTE' THEN
    IF v_room.phase != 'voting' THEN
      RETURN jsonb_build_object('error', 'Not in voting phase');
    END IF;

    IF NOT v_player.is_alive THEN
      RETURN jsonb_build_object('error', 'Dead players cannot vote');
    END IF;

    v_new_state := v_room.game_state || jsonb_build_object(
      'votes', COALESCE(v_room.game_state->'votes', '[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object(
          'voter_id', p_player_id::TEXT,
          'voter_name', v_player.name,
          'voted_for_id', (v_payload->>'voted_for_id')::TEXT,
          'timestamp', TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        ))
    );

    UPDATE rooms SET
      game_state = v_new_state,
      version = version + 1
    WHERE id = p_room_id;

    RETURN jsonb_build_object('success', TRUE, 'message', 'Vote recorded');

  ELSE
    RETURN jsonb_build_object('error', 'Unknown action type');
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
