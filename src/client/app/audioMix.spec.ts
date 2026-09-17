import { expect, it } from 'vitest';
import {
 matchMusicDuck,
 matchMusicLevel,
 menuOrganLevel,
 pieceCaptureLevel,
 pieceMoveLevel,
 pieceSelectLevel,
 pieceBarkLevel,
 sfxBus,
 voiceBus,
} from './audioMix';
import audio from './menuAudio.ts?raw';
import piece from './pieceSfx.ts?raw';

it('keeps voice above SFX and match bed below the menu organ', () => {
 expect(voiceBus).toBeGreaterThan(sfxBus);
 expect(matchMusicLevel).toBeLessThan(menuOrganLevel);
 expect(matchMusicLevel).toBeGreaterThanOrEqual(.12);
 expect(matchMusicLevel).toBeLessThanOrEqual(.22);
 expect(matchMusicDuck).toBeLessThan(.35);
 expect(pieceMoveLevel).toBeLessThan(pieceCaptureLevel);
 expect(pieceSelectLevel).toBeLessThan(pieceMoveLevel);
 expect(pieceBarkLevel).toBe(0.4);
 expect(audio).toContain('voiceBus');
 expect(audio).not.toMatch(/say=\(name:string\)=>\{[^}]*sound\(name\)/s);
 expect(piece).toContain('pieceMoveLevel');
});
