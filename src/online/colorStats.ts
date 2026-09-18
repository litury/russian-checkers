export const COLOR_STATS_CACHE_MS = 60_000;

export type ColorStats = { white: number; black: number; games: number };

export const colorStatsSql = `
SELECT
  count(*) FILTER (WHERE winner = 'white')::int AS white,
  count(*) FILTER (WHERE winner = 'black')::int AS black,
  count(*)::int AS games
 FROM matches m
 WHERE m.mode = 'online'
   AND m.winner IN ('white', 'black')
`.trim();

export function colorStatLabel(stats: ColorStats | null, side: 'white' | 'black'): string {
 if (!stats) return '';
 return String(side === 'white' ? stats.white : stats.black);
}
