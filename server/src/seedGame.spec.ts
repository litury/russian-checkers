import { describe, expect, it } from 'vitest';
import { applyPly } from '../../src/online/replay.ts';
import { createInitialPosition, resultSide, type IPosition } from '../../src/rules/index.ts';
import { hashPosition } from '../../src/online/matchState.ts';
import { generateGame, mulberry32 } from './seedGame.ts';
import { buildFixture } from './seed/fixture.ts';

describe('seedGame', () => {
 it('generates legal replay and stops on the first actual rules result', () => {
  for (const seed of [7, 42, 90]) {
   const game = generateGame(mulberry32(seed));
   expect(game.status).toBe('finished');
   let position = createInitialPosition();
   const keys = [hashPosition(position)];
   for (const ply of game.plies) {
    expect(resultSide(position, keys)).toBeNull();
    const next = applyPly(position, ply);
    expect(next).not.toBeNull();
    position = next!;
    keys.push(hashPosition(position));
   }
   expect(resultSide(position, keys)).toBe(game.result);
  }
 });
 it('does not turn a computation limit into draw', () => {
  for (const max of [0, 1]) expect(generateGame(mulberry32(42), max)).toMatchObject({ status: 'unfinished', result: null });
  for (const max of [-1, 0.5, Infinity, 1001]) expect(() => generateGame(mulberry32(42), max)).toThrow();
 });
 it('recognizes a terminal no-move position even at zero budget', () => {
  const position: IPosition = { turn: 'white', squares: Array.from({ length: 8 }, () => Array(8).fill(null)) };
  position.squares[0][1] = { side: 'black', kind: 'king' };
  expect(generateGame(mulberry32(42), 0, position)).toMatchObject({ status: 'finished', result: 'black', plies: [] });
 });
 it('is deterministic for the same seed', () => {
  expect(generateGame(mulberry32(7))).toEqual(generateGame(mulberry32(7)));
 });
 it('reproduces IDs, dates and moves independently of earlier mode counts', () => {
  const fixture = buildFixture({ online: 1, bot: 1 });
  expect(buildFixture({ online: 1, bot: 1 })).toEqual(fixture);
  expect(buildFixture({ online: 0, bot: 1 }).matches).toEqual(fixture.matches.filter(m => m.mode === 'bot'));
  expect(buildFixture({ online: 0, bot: 0 })).toEqual({ players: [], matches: [] });
 });
});
