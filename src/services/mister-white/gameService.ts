import { getSupabaseClient } from '@/lib/supabase/client';

const supabase = getSupabaseClient();

export interface ActionParams {
  roomId: string;
  playerId: string;
  version: number;
}

async function dispatchAction(
  params: ActionParams,
  actionType: string,
  payload: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.rpc('handle_action', {
    p_room_id: params.roomId,
    p_player_id: params.playerId,
    p_action_type: actionType,
    p_payload: payload,
    p_expected_version: params.version,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function startGame(params: ActionParams) {
  return dispatchAction(params, 'START_GAME');
}

export async function playerReady(params: ActionParams) {
  return dispatchAction(params, 'PLAYER_READY');
}

export async function voteCategory(params: ActionParams, category: string) {
  return dispatchAction(params, 'VOTE_CATEGORY', { category });
}

export async function resolveCategoryVote(params: ActionParams) {
  return dispatchAction(params, 'RESOLVE_CATEGORY_VOTE');
}

export async function playerGotIt(params: ActionParams) {
  return dispatchAction(params, 'PLAYER_GOT_IT');
}

export async function submitHint(params: ActionParams, hint: string) {
  return dispatchAction(params, 'SUBMIT_HINT', { hint });
}

export async function skipHint(params: ActionParams) {
  return dispatchAction(params, 'SKIP_HINT');
}

export async function castVote(params: ActionParams, targetId: string | null) {
  return dispatchAction(params, 'VOTE', { target_id: targetId });
}

export async function resolveVote(params: ActionParams) {
  return dispatchAction(params, 'RESOLVE_VOTE');
}

export async function nextRound(params: ActionParams) {
  return dispatchAction(params, 'NEXT_ROUND');
}
