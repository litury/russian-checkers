import { expect, it } from 'vitest';
import { apply, createInitialPosition, legalMoves } from '@/rules';
import { buildHistoryReplay, halfMoveCount, incompleteReplayCopy, isMatchRow, outcomeLabel } from './historyReplay';
import { squareAlg } from './notation';

it('labels outcome relative to own side without inventing finish reasons', () => {
 expect(outcomeLabel({ color: 'black', winner: 'black' })).toBe('Победа');
 expect(outcomeLabel({ color: 'black', winner: 'white' })).toBe('Поражение');
 expect(outcomeLabel({ color: 'white', winner: 'draw' })).toBe('Ничья');
 expect(outcomeLabel({ color: 'white', winner: null })).toBe('Без результата');
 expect(halfMoveCount(1)).toBe('1 полуход');
 expect(halfMoveCount(2)).toBe('2 полухода');
 expect(halfMoveCount(5)).toBe('5 полуходов');
 expect(halfMoveCount(11)).toBe('11 полуходов');
 expect(halfMoveCount(21)).toBe('21 полуход');
 expect(incompleteReplayCopy(1)).toContain('Доступен 1 полуход');
 expect(incompleteReplayCopy(1)).not.toContain('полуходов');
});
it('keeps only valid prefix and flags malformed, missing and illegal moves', () => {
 const first = { side: 'white', from: 'a3', path: ['b4'] };
 expect(buildHistoryReplay([first], 1).notation).toEqual(['a3-b4']);
 for (const bad of [null, {}, { side: 'black', from: 'b6', path: [null] }, first, { side: 'black', from: 'b6', path: ['z9'] }]) {
  const result = buildHistoryReplay([first, bad], 2);
  expect(result.incomplete).toBe(true);
  expect(result.plies).toHaveLength(1);
  expect(result.positions).toHaveLength(2);
 }
 expect(buildHistoryReplay([first], 2).incomplete).toBe(true);
 expect(buildHistoryReplay([], 0).incomplete).toBe(false);
 // A legal prefix need not end in a rules win (e.g. resignation).
 expect(buildHistoryReplay([first], 1).incomplete).toBe(false);
});
it('reconstructs legal games including captures and promotion without skipped positions', () => {
 let sawKing = false;
 let sawCapture = false;
 for (let seed = 1; seed <= 8; seed++) {
  let random = seed;
  let pos = createInitialPosition();
  const raw = [];
  for (let i = 0; i < 240; i++) {
   const moves = legalMoves(pos);
   if (!moves.length) break;
   random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
   const move = moves[random % moves.length];
   raw.push({ side: pos.turn, from: squareAlg(move.from), path: move.path.map(squareAlg) });
   pos = apply(pos, move)!;
  }
  const result = buildHistoryReplay(raw, raw.length);
  expect(result.incomplete).toBe(false);
  expect(result.positions.at(-1)).toEqual(pos);
  sawCapture ||= result.notation.some(move => move.includes(':'));
  sawKing ||= result.positions.some(p => p.squares.flat().some(piece => piece?.kind === 'king'));
 }
 expect(sawCapture).toBe(true);
 expect(sawKing).toBe(true);
});
it('rejects invalid API rows instead of treating failures as an empty archive', () => {
 const row = { id: 'test', color: 'white', mode: 'bot', winner: null, startedAt: '', plies: 0 };
 expect(isMatchRow(row)).toBe(true);
 for (const change of [{ plies: -1 }, { plies: 1.5 }, { color: 'red' }, { mode: 'fake' }, { winner: 'fake' }, { id: null }]) expect(isMatchRow({ ...row, ...change })).toBe(false);
});
