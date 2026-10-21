import { winner } from './winner';
import type { IPosition } from './types/IPosition';
import type { Side } from './types/Side';

function tally(position: IPosition) {
 let whiteMan = 0, blackMan = 0, whiteKing = 0, blackKing = 0;
 for (const row of position.squares) {
  for (const piece of row) {
   if (!piece) continue;
   if (piece.kind === 'king') {
    if (piece.side === 'white') whiteKing += 1;
    else blackKing += 1;
   } else if (piece.side === 'white') whiteMan += 1;
   else blackMan += 1;
  }
 }
 return { whiteMan, blackMan, whiteKing, blackKing };
}

export function hasWinningMaterial(position: IPosition): boolean {
 const t = tally(position);
 if (t.whiteMan + t.blackMan > 0) return true;
 const a = t.whiteKing, b = t.blackKing;
 return Math.abs(a - b) >= 2 || Math.max(a, b) >= 3;
}

export function insufficientMaterial(position: IPosition): boolean {
 const t = tally(position);
 if (t.whiteMan + t.blackMan > 0) return false;
 if (hasWinningMaterial(position)) return false;
 return t.whiteKing <= 1 && t.blackKing <= 1 && t.whiteKing + t.blackKing > 0;
}

export function isThreefold(keys: string[]): boolean {
 const last = keys[keys.length - 1];
 if (!last) return false;
 return keys.filter((k) => k === last).length >= 3;
}

export function isMatchDraw(position: IPosition, keys: string[]): boolean {
 if (winner(position)) return false;
 if (isThreefold(keys)) return true;
 if (hasWinningMaterial(position)) return false;
 return false;
}

export function resultSide(position: IPosition, keys: string[]): Side | 'draw' | null {
 const w = winner(position);
 if (w) return w;
 if (isMatchDraw(position, keys)) return 'draw';
 return null;
}
