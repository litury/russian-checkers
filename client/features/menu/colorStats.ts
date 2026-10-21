export type ColorStats = { white: number; black: number; games: number };

export function colorStatLabel(stats: ColorStats | null, side: 'white' | 'black'): string {
 if (!stats) return '';
 return String(side === 'white' ? stats.white : stats.black);
}
