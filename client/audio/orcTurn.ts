export const orcArenaLine = 'arena-k-boyu';

export function orcOpeningTurnLine(humanSide: 'white' | 'black'): 'tvoy-hod' | 'hod-protivnika' {
 return humanSide === 'white' ? 'tvoy-hod' : 'hod-protivnika';
}
