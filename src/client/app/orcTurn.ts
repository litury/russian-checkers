export function orcTurnLine(skipOpeningTurn: boolean, humanTurn: boolean, capture: boolean):
 'tvoy-hod' | 'hod-protivnika' | 'atakuy' | 'zashchishchaysya' | null {
 if (skipOpeningTurn) return null;
 if (humanTurn) return capture ? 'atakuy' : 'tvoy-hod';
 return capture ? 'zashchishchaysya' : 'hod-protivnika';
}

export const orcArenaLine = 'arena-k-boyu';
