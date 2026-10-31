import { winner } from './winner';
import { hasCountedDraw } from './drawCounters';
import type { IPosition } from './types/IPosition';
import type { Side } from './types/Side';

export function isThreefold(keys: string[]): boolean {
 const last = keys[keys.length - 1];
 if (!last) return false;
 return keys.filter((k) => k === last).length >= 3;
}

export function isMatchDraw(position: IPosition, keys: string[]): boolean {
 if (winner(position)) return false;
 if (isThreefold(keys)) return true;
 if (hasCountedDraw(position)) return true;
 return false;
}

export function resultSide(position: IPosition, keys: string[]): Side | 'draw' | null {
 const w = winner(position);
 if (w) return w;
 if (isMatchDraw(position, keys)) return 'draw';
 return null;
}
