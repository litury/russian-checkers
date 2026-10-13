import { afterEach, expect, it, vi } from 'vitest';
import { bindPieceSfx, bindPieceVoice, pieceTakeoffSfx, pieceCaptureSfx, pieceAhDelayMs } from './pieceSfx';
import { bindKingFireSfx, kingFireIgniteSfx } from './kingFireSfx';
import { pieceCaptureLevel, kingPromotionLevel, pieceMoveLevel, sfxBus, voiceBus, uiOpenLevel, panelReadyLevel, undoAppliedLevel } from './audioMix';
import board from '../modules/board/createReliquaryBoardView.ts?raw';

afterEach(() => {
 bindPieceSfx(() => {}); bindPieceVoice(() => {}); bindKingFireSfx(() => {}); vi.useRealTimers();
});

it.each(['white', 'black'] as const)('suppresses only capture takeoff for %s, retaining contact and victim cry', side => {
 vi.useFakeTimers(); const play = vi.fn(); const cut = vi.fn();
 bindPieceSfx(play); bindPieceVoice(() => {}, cut);
 pieceTakeoffSfx(false, true, side);
 expect(cut).toHaveBeenCalledTimes(1); expect(play).not.toHaveBeenCalled();
 const victim = side === 'white' ? 'black' : 'white';
 pieceCaptureSfx(victim);
 expect(play.mock.calls).toEqual([['crush-b', pieceCaptureLevel]]);
 vi.advanceTimersByTime(pieceAhDelayMs);
 expect(play.mock.calls).toEqual([['crush-b', pieceCaptureLevel], [victim === 'black' ? 'ah' : 'ah-elf', 1]]);
 play.mockClear(); pieceTakeoffSfx(false, false, side);
 expect(play.mock.calls).toEqual([[side === 'white' ? 'move-w' : 'b-click', pieceMoveLevel]]);
 play.mockClear(); pieceTakeoffSfx(true, false, side); expect(play).not.toHaveBeenCalled();
});

it('routes actual renderer takeoff by victim and contact separately', () => {
 expect(board).toMatch(/pieceTakeoffSfx\(\s*view.kind === 'king',\s*Boolean\(victim\),\s*view.side/);
 expect(board).toContain('if (taken) pieceCaptureSfx(taken.side)');
});

it('uses measured per-cue emphasis without raising master, voice, move or cry', () => {
 expect(sfxBus).toBe(.65); expect(voiceBus).toBe(.45); expect(pieceMoveLevel).toBe(.9);
 expect(pieceCaptureLevel).toBe(1.4); expect(kingPromotionLevel).toBe(1.6);
 expect([uiOpenLevel, panelReadyLevel, undoAppliedLevel]).toEqual([.6, .6, .6]);
 const play = vi.fn(); bindKingFireSfx(play);
 kingFireIgniteSfx(false); kingFireIgniteSfx(true);
 expect(play.mock.calls).toEqual([['ignite-a', 1.6], ['ignite-a', 1.6]]);
});
