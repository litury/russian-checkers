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
 expect(scene).not.toContain('if (!same) pieceSelectSfx');
});
it('adds random lab/gob short select barks at 0.4 and cuts bark on takeoff', () => {
 const heard: string[] = [];
 const levels: number[] = [];
 let cuts = 0;
 bindPieceSfx(name => heard.push(name));
 bindPieceVoice((name, level) => { heard.push(name); levels.push(level ?? 1); }, () => { cuts += 1; });
 pieceSelectSfx('white');
 expect(heard[0]).toBe(pieceSelectCue);
 expect(elfSelectBarks).toContain(heard[1]);
 expect(elfSelectBarks).toEqual(['lab-ibo', 'lab-est', 'lab-rabota', 'lab-boi']);
 expect(levels[0]).toBe(0.4);
 heard.length = 0;
 pieceSelectSfx('black');
 expect(orcSelectBarks).toContain(heard[1]);
 expect(orcSelectBarks).toEqual(['gob-ibo', 'gob-est', 'gob-rubi', 'gob-boi']);
 pieceStepSfx(false, false, 'white');
 expect(cuts).toBe(1);
 expect(board).toContain('pieceStepSfx');
 expect(pieceCaptureCue).toBe('crush-b');
});
it('picks opponent taunt on human defeat', () => {
 expect(orcTaunts).toContain(defeatTauntCue('white'));
 expect(elfTaunts).toContain(defeatTauntCue('black'));
 expect(scene).toContain('defeatTauntCue');
 expect(menu).toContain('voiceStealSec');
});
