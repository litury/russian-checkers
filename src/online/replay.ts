import { apply, createInitialPosition, winner, type IMove, type IPosition, type Side } from '@/rules';
import { parseAlg } from './notation';

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

export function replayPlies(plies: RecordedPly[]): { ok: true; winner: Side | null } | { ok: false; ply: number } {
 let position = createInitialPosition();
 let i = 0;
 for (const ply of plies) {
  i += 1;
  const next = applyPly(position, ply);
  if (!next) return { ok: false, ply: i };
  position = next;
 }
 return { ok: true, winner: winner(position) };
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
