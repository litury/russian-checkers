import { winner } from './winner';
import { countedDrawReason } from './drawCounters';
import type { DrawReason } from './drawReason';
import type { IPosition } from './types/IPosition';
import type { Side } from './types/Side';

export function isThreefold(keys: string[]): boolean {
 const last = keys[keys.length - 1];
 if (!last) return false;
 return keys.filter((k) => k === last).length >= 3;
}

export function isMatchDraw(position: IPosition, keys: string[]): boolean {
 return drawReason(position, keys) !== null;
}

export function drawReason(position: IPosition, keys: string[]): DrawReason | null {
 if (winner(position)) return null;
 if (isThreefold(keys)) return 'draw_repetition';
 return countedDrawReason(position);
}

export function resultSide(position: IPosition, keys: string[]): Side | 'draw' | null {
 const w = winner(position);
 if (w) return w;
 if (isMatchDraw(position, keys)) return 'draw';
 return null;
}
