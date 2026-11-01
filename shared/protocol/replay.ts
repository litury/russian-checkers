import { apply, createInitialPosition, resultSide, type IMove, type IPosition, type Side } from '@/shared/rules';
import { hashPosition } from './matchState';
import { parseAlg } from './notation';
import { drawReason } from '../rules/draw';
import type { DrawReason } from '../rules/drawReason';

export type RecordedPly = { side: Side; from: string; path: string[] };

export function plyToMove(ply: RecordedPly): IMove | null {
 const from = parseAlg(ply.from);
 const path = ply.path.map(parseAlg);
 if (!from || path.some((s) => !s)) return null;
 return { from, path: path as NonNullable<ReturnType<typeof parseAlg>>[] };
}

export function applyPly(position: IPosition, ply: RecordedPly): IPosition | null {
 if (ply.side !== position.turn) return null;
 const move = plyToMove(ply);
 return move ? apply(position, move) : null;
}

export function replayPlies(plies: RecordedPly[]): { ok: true; winner: Side | 'draw' | null; drawReason?: DrawReason } | { ok: false; ply: number } {
 let position = createInitialPosition();
 const keys = [hashPosition(position)];
 let outcome: Side | 'draw' | null = null;
 let i = 0;
 for (const ply of plies) {
  i += 1;
  if (outcome) return { ok: false, ply: i };
  const next = applyPly(position, ply);
  if (!next) return { ok: false, ply: i };
  position = next;
  keys.push(hashPosition(position));
  outcome = resultSide(position, keys);
 }
 const reason = outcome === 'draw' ? drawReason(position, keys) : null;
 return { ok: true, winner: outcome, ...(reason ? { drawReason: reason } : {}) };
}

export function positionAt(plies: RecordedPly[], n: number): IPosition {
 let position = createInitialPosition();
 const max = Math.max(0, Math.min(n, plies.length));
 for (let i = 0; i < max; i += 1) {
  const next = applyPly(position, plies[i]);
  if (!next) break;
  position = next;
 }
 return position;
}
