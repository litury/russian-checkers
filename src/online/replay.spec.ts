import { expect, it } from 'vitest';
import { createInitialPosition, legalMoves } from '@/rules';
import { squareAlg } from './notation';
import { replayPlies, positionAt } from './replay';

it('replays a legal first white hop and rejects an illegal ply', () => {
 const start = createInitialPosition();
 const move = legalMoves(start)[0];
 expect(move).toBeTruthy();
 const ply = {
  side: 'white' as const,
  from: squareAlg(move.from),
  path: move.path.map(squareAlg),
 };
 const ok = replayPlies([ply]);
 expect(ok).toEqual({ ok: true, winner: null });
 expect(positionAt([], 0).turn).toBe('white');
 expect(positionAt([ply], 1).turn).toBe('black');
 expect(replayPlies([{ ...ply, from: 'a1' }]).ok).toBe(false);
});
