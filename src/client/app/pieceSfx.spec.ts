import { afterEach, expect, it, vi } from 'vitest';
import {
 bindPieceSfx,
 pieceAhCue,
 pieceAhDelayMs,
 pieceCaptureCue,
 pieceMoveCue,
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

it('plays move for a quiet man and never a second move on king trail', () => {
 const heard: string[] = [];
 bindPieceSfx(name => heard.push(name));
 pieceStepSfx(true, false);
 expect(heard).toEqual([]);
 pieceStepSfx(false, false);
 expect(heard).toEqual([pieceMoveCue]);
 expect(pieceMoveCue).toBe('move-2');
 expect(pieceSelectCue).toBe('select-b');
});

it('overlaps crush-b with ah after 100ms and never plays old capture.wav', () => {
 vi.useFakeTimers();
 const heard: string[] = [];
 bindPieceSfx(name => heard.push(name));
 pieceStepSfx(false, true);
 expect(heard).toEqual([pieceCaptureCue]);
 expect(pieceCaptureCue).toBe('crush-b');
 vi.advanceTimersByTime(pieceAhDelayMs);
 expect(heard).toEqual([pieceCaptureCue, pieceAhCue]);
 expect(pieceAhDelayMs).toBeGreaterThanOrEqual(80);
 expect(pieceAhDelayMs).toBeLessThanOrEqual(120);
});

it('is wired on takeoff, not per frame', () => {
 expect(board).toContain('pieceStepSfx');
});
it('plays select-b on extend, not availability', () => {
 const heard: string[] = [];
 bindPieceSfx(name => heard.push(name));
 pieceSelectSfx();
 expect(heard).toEqual([pieceSelectCue]);
 expect(scene).toContain('pieceSelectSfx');
});
