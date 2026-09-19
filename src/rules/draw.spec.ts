import { expect, it } from 'vitest';
import { hasWinningMaterial, isMatchDraw } from './draw';
import src from '../../server/src/index.ts?raw';
import type { IPosition } from './types/IPosition';
import type { IPiece } from './types/IPiece';
import type { Side } from './types/Side';

function pos(kings: { w: number; b: number }, turn: Side = 'white'): IPosition {
 const squares: (IPiece | null)[][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
 const dark: [number, number][] = [];
 for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) if ((r + c) % 2 === 1) dark.push([r, c]);
 let i = 0;
 for (let n = 0; n < kings.w; n += 1) {
  const [r, c] = dark[i++];
  squares[r][c] = { side: 'white', kind: 'king' };
 }
 for (let n = 0; n < kings.b; n += 1) {
  const [r, c] = dark[i++];
  squares[r][c] = { side: 'black', kind: 'king' };
 }
 return { squares, turn };
}

it('5 kings vs 1 is winning material, not auto-draw after quiet plies', () => {
 const p = pos({ w: 5, b: 1 });
 expect(hasWinningMaterial(p)).toBe(true);
 const keys = Array.from({ length: 20 }, (_, n) => `white|unique${n}`);
 expect(isMatchDraw(p, keys)).toBe(false);
});

it('threefold with same turn is a draw', () => {
 const p = pos({ w: 1, b: 1 });
 const k = 'white|same';
 expect(isMatchDraw(p, [k, 'other', k, k])).toBe(true);
 expect(src).toContain('resultSide');
 expect(src).toContain('room.keys');
});
