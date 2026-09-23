import { apply, createInitialPosition, legalMoves, resultSide, type IPosition } from '../../src/rules/index.ts';
import { hashPosition } from '../../src/online/matchState.ts';
import { squareAlg } from '../../src/online/notation.ts';
import type { RecordedPly } from '../../src/online/replay.ts';

export type GameResult = 'white' | 'black' | 'draw';
export const mulberry32 = (seed: number) => {
 let a = seed >>> 0;
 return () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
 };
};

/** A computation budget is not a result. History includes the starting position. */
export function generateGame(rand: () => number, maxPlies = 1000, initial: IPosition = createInitialPosition()) {
 if (!Number.isInteger(maxPlies) || maxPlies < 0 || maxPlies > 1000) throw new Error('Invalid ply budget');
 let position = initial;
 const keys = [hashPosition(position)];
 const plies: RecordedPly[] = [];
 for (;;) {
  const result = resultSide(position, keys);
  if (result) return { status: 'finished' as const, plies, result };
  if (plies.length >= maxPlies) return { status: 'unfinished' as const, plies, result: null };
  const moves = legalMoves(position);
  const r = rand();
  if (!Number.isFinite(r) || r < 0 || r >= 1) throw new Error('Invalid random source');
  const move = moves[Math.floor(r * moves.length)];
  if (!move) throw new Error('Rules invariant: no move without result');
  const next = apply(position, move);
  if (!next) throw new Error('Rules rejected generated move');
  plies.push({ side: position.turn, from: squareAlg(move.from), path: move.path.map(squareAlg) });
  position = next;
  keys.push(hashPosition(position));
 }
}
