import { afterEach, expect, it, vi } from 'vitest';
import {
 bindPieceSfx,
 bindPieceVoice,
 pieceAhDelayMs,
 pieceAhElfCue,
 pieceAhOrcCue,
 pieceCaptureCue,
 pieceMoveBlackCue,
 pieceMoveWhiteCue,
 pieceSelectCue,
 pieceSelectSfx,
 pieceStepSfx,
 elfSelectBarks,
 orcSelectBarks,
 elfTaunts,
 orcTaunts,
 defeatTauntCue,
} from './pieceSfx';
import board from '@/client/modules/board/createReliquaryBoardView.ts?raw';
import scene from './gameScene.ts?raw';
import menu from './menuAudio.ts?raw';

afterEach(() => {
 vi.useRealTimers();
 bindPieceSfx(() => {});
 bindPieceVoice(() => {});
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
it('adds random full elf/orc select barks, not chopped uh/da/vpered', () => {
 const heard: string[] = [];
 bindPieceSfx(name => heard.push(name));
 bindPieceVoice(name => heard.push(name));
 pieceSelectSfx('white');
 expect(heard[0]).toBe(pieceSelectCue);
 expect(elfSelectBarks).toContain(heard[1]);
 heard.length = 0;
 pieceSelectSfx('black');
 expect(heard[0]).toBe(pieceSelectCue);
 expect(orcSelectBarks).toContain(heard[1]);
 expect(elfSelectBarks.join()).not.toMatch(/elf-uh|elf-da|elf-vpered/);
 expect(pieceCaptureCue).toBe('crush-b');
});
it('picks opponent taunt on human defeat', () => {
 expect(orcTaunts).toContain(defeatTauntCue('white'));
 expect(elfTaunts).toContain(defeatTauntCue('black'));
 expect(scene).toContain('defeatTauntCue');
 expect(menu).toContain('voiceStealSec');
});
