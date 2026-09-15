import { expect, it } from 'vitest';
import { bindPieceSfx, pieceCaptureCue, pieceMoveCue, pieceStepSfx } from './pieceSfx';
import board from '@/client/modules/board/createReliquaryBoardView.ts?raw';

it('plays move for a quiet man and capture for a take, never a second move on king trail', () => {
 const heard: string[] = [];
 bindPieceSfx(name => heard.push(name));
 pieceStepSfx(true, false);
 expect(heard).toEqual([]);
 pieceStepSfx(false, false);
 pieceStepSfx(false, true);
 pieceStepSfx(true, true);
 expect(heard).toEqual([pieceMoveCue, pieceCaptureCue, pieceCaptureCue]);
 bindPieceSfx(() => {});
});

it('is wired on takeoff, not per frame', () => {
 expect(board).toContain('pieceStepSfx');
});
