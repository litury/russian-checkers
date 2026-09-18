import { describe, expect, it } from 'vitest';
import type { IPiece, IPosition } from '@/rules';
import { apply, createInitialPosition, legalMoves } from '@/rules';
import { pickBotMove } from './pickBotMove';
import scene from '../../app/gameScene.ts?raw';

function emptySquares(): (IPiece | null)[][] {
 return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
}

function seed(n: number): () => number {
 let x = n >>> 0 || 1;
 return () => {
  x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
  return x / 2 ** 32;
 };
}

describe('pickBotMove', () => {
 it('picks a legal move from the starting position', () => {
  const start = createInitialPosition();
  const moves = legalMoves(start);
  const picked = pickBotMove(start, seed(1), 'normal');
  expect(picked).toBeDefined();
  expect(moves).toContainEqual(picked);
  expect(apply(start, picked!)).not.toBeNull();
 });

 it('captures when a capture exists', () => {
  const squares = emptySquares();
  squares[2][2] = { side: 'black', kind: 'man' };
  squares[3][3] = { side: 'white', kind: 'man' };
  const position: IPosition = { squares, turn: 'black' };
  const quiet = { from: { row: 2, col: 2 }, path: [{ row: 3, col: 1 }] };
  const capture = { from: { row: 2, col: 2 }, path: [{ row: 4, col: 4 }] };
  expect(legalMoves(position)).toContainEqual(capture);
  const picked = pickBotMove(position, seed(2), 'hard');
  expect(picked).toEqual(capture);
  expect(picked).not.toEqual(quiet);
 });

 it('never returns a move that apply rejects over a seeded game', () => {
  let pos = createInitialPosition();
  const random = seed(7);
  for (let ply = 0; ply < 40; ply += 1) {
   const moves = legalMoves(pos);
   if (moves.length === 0) {
    expect(pickBotMove(pos, random, 'easy')).toBeUndefined();
    break;
   }
   const picked = pickBotMove(pos, random, 'easy');
   expect(picked).toBeDefined();
   expect(moves).toContainEqual(picked);
   const next = apply(pos, picked!);
   expect(next).not.toBeNull();
   pos = next!;
  }
 });

 it('is not used on the online path', () => {
  expect(scene).toMatch(/if \(this\.online\) return;[\s\S]*pickBotMove/);
 });
});
