-- 004: Room-level settings + END_TURN action.
--
-- Why:
--   * The game is played in person (couch setting); players speak hints aloud.
--     The "submit hint text" action becomes a "this player has finished their
--     turn" action — END_TURN.
--   * Hosts now configure: max player count, per-turn hint timer, voting timer.
--   * When the last alive player ends their turn for a round, the server
--     auto-transitions the room to the voting phase.
--
-- This migration is idempotent: ALTER TABLE ... ADD COLUMN IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION.

-- ============ Room settings columns ============

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS max_players INT NOT NULL DEFAULT 10
    CHECK (max_players BETWEEN 3 AND 20);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS hint_timer_seconds INT NOT NULL DEFAULT 15
    CHECK (hint_timer_seconds BETWEEN 10 AND 30);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS vote_timer_seconds INT NOT NULL DEFAULT 120
    CHECK (vote_timer_seconds BETWEEN 60 AND 300);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS phase_started_at TIMESTAMPTZ;

-- ============ handle_action ============

CREATE OR REPLACE FUNCTION handle_action(
  p_room_id UUID,
  p_player_id UUID,
  p_action JSONB,
  p_expected_version INT
)
RETURNS JSONB AS $$
DECLARE
  v_room              rooms%ROWTYPE;
  v_player            room_players%ROWTYPE;
  v_action_type       TEXT;
  v_payload           JSONB;
  v_new_state         JSONB;
  v_player_count      INT;
  v_alive_count       INT;
  v_turns_taken       JSONB;
  v_next_player_id    UUID;
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
  v_payload     := p_action->'payload';

  -- ============ START_GAME ============
  IF v_action_type = 'START_GAME' THEN
    IF NOT v_player.is_host THEN
      RETURN jsonb_build_object('error', 'Only host can start game');
    END IF;

    SELECT COUNT(*) INTO v_player_count
    FROM room_players WHERE room_id = p_room_id;

    IF v_player_count < 3 THEN
      RETURN jsonb_build_object('error', 'Need at least 3 players');
    END IF;

    IF v_player_count > v_room.max_players THEN
      RETURN jsonb_build_object('error', 'Room over capacity');
    END IF;

    IF v_room.status != 'waiting' THEN
      RETURN jsonb_build_object('error', 'Game already started');
    END IF;

    -- Unique random seating rank for every player.
    WITH shuffled AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY RANDOM()) - 1 AS new_idx
      FROM room_players
      WHERE room_id = p_room_id
    )
    UPDATE room_players rp
    SET order_index = shuffled.new_idx
    FROM shuffled
    WHERE rp.id = shuffled.id;

    -- Build initial game_state.
    v_new_state := jsonb_build_object(
      'round', 1,
      'category', 'Animal',
      'players', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',    t.id::TEXT,
            'name',  t.name,
            'role',  CASE WHEN t.rn = 1 THEN 'mr_white' ELSE 'civilian' END,
            'alive', TRUE,
            'word',  CASE WHEN t.rn = 1 THEN NULL ELSE 'elephant' END
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
      'turns_taken', '[]'::jsonb,
      'votes',       '[]'::jsonb
    );

    UPDATE rooms SET
      status                 = 'playing',
      phase                  = 'hinting',
      game_state             = v_new_state,
      current_turn_player_id = (
        SELECT id FROM room_players
        WHERE room_id = p_room_id AND is_alive = TRUE
        ORDER BY order_index LIMIT 1
      ),
      phase_started_at       = NOW(),
      version                = version + 1
    WHERE id = p_room_id;

    RETURN jsonb_build_object('success', TRUE, 'message', 'Game started');

  -- ============ END_TURN ============
  -- Player has finished saying their hint out loud. Mark this player's turn
  -- as taken. If everyone alive has gone, flip the room into voting.
  ELSIF v_action_type = 'END_TURN' THEN
    IF v_room.current_turn_player_id != p_player_id THEN
      RETURN jsonb_build_object('error', 'Not your turn');
    END IF;

    IF v_room.phase != 'hinting' THEN
      RETURN jsonb_build_object('error', 'Not in hinting phase');
    END IF;

    IF NOT v_player.is_alive THEN
      RETURN jsonb_build_object('error', 'Player is not alive');
    END IF;

    SELECT COUNT(*) INTO v_alive_count
    FROM room_players WHERE room_id = p_room_id AND is_alive = TRUE;

    v_turns_taken := COALESCE(v_room.game_state->'turns_taken', '[]'::jsonb)
                  || jsonb_build_array(p_player_id::TEXT);

    IF jsonb_array_length(v_turns_taken) >= v_alive_count THEN
      -- Round of hinting complete → voting phase.
      v_new_state := v_room.game_state
        || jsonb_build_object('turns_taken', '[]'::jsonb)
        || jsonb_build_object('votes',       '[]'::jsonb);

      UPDATE rooms SET
        phase                  = 'voting',
        game_state             = v_new_state,
        current_turn_player_id = NULL,
        phase_started_at       = NOW(),
        version                = version + 1
      WHERE id = p_room_id;

      RETURN jsonb_build_object('success', TRUE, 'message', 'Voting started');
    END IF;

    -- Otherwise advance to the next alive player by order_index (wrap-around).
    SELECT id INTO v_next_player_id FROM room_players
    WHERE room_id = p_room_id
      AND is_alive = TRUE
      AND order_index > v_player.order_index
    ORDER BY order_index ASC LIMIT 1;

    IF v_next_player_id IS NULL THEN
      SELECT id INTO v_next_player_id FROM room_players
      WHERE room_id = p_room_id AND is_alive = TRUE
      ORDER BY order_index ASC LIMIT 1;
    END IF;

    v_new_state := v_room.game_state
      || jsonb_build_object('turns_taken', v_turns_taken);

    UPDATE rooms SET
      game_state             = v_new_state,
      current_turn_player_id = v_next_player_id,
      version                = version + 1
    WHERE id = p_room_id;

    RETURN jsonb_build_object('success', TRUE, 'message', 'Turn ended');

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
          'voter_id',     p_player_id::TEXT,
          'voter_name',   v_player.name,
          'voted_for_id', (v_payload->>'voted_for_id')::TEXT,
          'timestamp',    TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        ))
    );

    UPDATE rooms SET
      game_state = v_new_state,
      version    = version + 1
    WHERE id = p_room_id;

    RETURN jsonb_build_object('success', TRUE, 'message', 'Vote recorded');

  ELSE
    RETURN jsonb_build_object('error', 'Unknown action type');
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
