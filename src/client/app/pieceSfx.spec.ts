import { afterEach, expect, it, vi } from 'vitest';
import {
 bindPieceSfx,
 pieceAhDelayMs,
 pieceAhElfCue,
 pieceAhOrcCue,
 pieceCaptureCue,
 pieceMoveBlackCue,
 pieceMoveWhiteCue,
 pieceSelectCue,
 pieceSelectSfx,
 pieceStepSfx,
} from './pieceSfx';
import board from '@/client/modules/board/createReliquaryBoardView.ts?raw';
import scene from './gameScene.ts?raw';

afterEach(() => {
 vi.useRealTimers();
 bindPieceSfx(() => {});
});

it('uses move-w for white men and b-click for black, one-shot per step, never a king quiet move', () => {
 const heard: string[] = [];
 bindPieceSfx(name => heard.push(name));
 pieceStepSfx(true, false, 'white');
 expect(heard).toEqual([]);
 pieceStepSfx(false, false, 'white');
 pieceStepSfx(false, false, 'black');
 expect(heard).toEqual([pieceMoveWhiteCue, pieceMoveBlackCue]);
 expect(pieceMoveWhiteCue).toBe('move-w');
 expect(pieceMoveBlackCue).toBe('b-click');
 expect(pieceSelectCue).toBe('select-b');
 expect(board).toContain('duration: 160');
});

it('uses orc ah on a black victim and elf ah on a white victim after crush-b', () => {
 vi.useFakeTimers();
 const heard: string[] = [];
 bindPieceSfx(name => heard.push(name));
 pieceStepSfx(false, true, 'white', 'black');
 expect(heard).toEqual([pieceMoveWhiteCue, pieceCaptureCue]);
 vi.advanceTimersByTime(pieceAhDelayMs);
 expect(heard).toEqual([pieceMoveWhiteCue, pieceCaptureCue, pieceAhOrcCue]);
 heard.length = 0;
 pieceStepSfx(false, true, 'black', 'white');
 vi.advanceTimersByTime(pieceAhDelayMs);
 expect(heard).toEqual([pieceMoveBlackCue, pieceCaptureCue, pieceAhElfCue]);
 heard.length = 0;
 pieceStepSfx(true, true, 'white', 'black');
 vi.advanceTimersByTime(pieceAhDelayMs);
 expect(heard).toEqual([pieceCaptureCue, pieceAhOrcCue]);
 expect(pieceAhOrcCue).toBe('ah');
 expect(pieceAhElfCue).toBe('ah-elf');
});

it('is wired on takeoff, not per frame', () => {
 expect(board).toContain('pieceStepSfx');
 expect(board).toContain('view.side');
});
it('plays select-b on extend, not availability', () => {
 const heard: string[] = [];
 bindPieceSfx(name => heard.push(name));
 pieceSelectSfx();
 expect(heard).toEqual([pieceSelectCue]);
 expect(scene).toContain('pieceSelectSfx');
});
