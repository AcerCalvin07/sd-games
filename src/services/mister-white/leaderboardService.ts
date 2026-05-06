import { getSupabaseClient } from '@/lib/supabase/client';

const supabase = getSupabaseClient();

export interface LeaderboardEntry {
  player_name: string;
  total_wins: number;
  total_games: number;
}

export async function getTopPlayers(limit = 10): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('player_name, total_wins, total_games')
    .order('total_wins', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardEntry[];
}
