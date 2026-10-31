export const COLOR_STATS_CACHE_MS = 60_000;

export const colorStatsSql = `
SELECT
  count(*) FILTER (WHERE winner = 'white')::int AS white,
  count(*) FILTER (WHERE winner = 'black')::int AS black,
  count(*)::int AS games
 FROM matches m
 WHERE m.mode = 'online'
   AND m.ended_at IS NOT NULL
   AND m.winner IN ('white', 'black')
`.trim();
