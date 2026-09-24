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

it('keeps announcer under SFX and match bed below the menu organ', () => {
 expect(voiceBus).toBe(.45);
 expect(voiceBus).toBeLessThan(sfxBus);
 expect(voiceBus).toBeLessThanOrEqual(1);
 expect(matchMusicLevel).toBeLessThan(menuOrganLevel);
 expect(matchMusicLevel).toBeGreaterThanOrEqual(.12);
 expect(matchMusicLevel).toBeLessThanOrEqual(.22);
 expect(matchMusicDuck).toBeLessThan(.35);
 expect(pieceMoveLevel).toBeLessThan(pieceCaptureLevel);
 expect(pieceSelectLevel).toBeLessThan(pieceMoveLevel);
 expect(pieceBarkLevel).toBe(0.4);
 expect(audio).toContain('voiceBus');
 expect(audio).toContain('settings().master*settings().effects*voiceBus*level');
 expect(audio).not.toMatch(/say=\(name:string\)=>\{[^}]*sound\(name\)/s);
 expect(piece).toContain('pieceMoveLevel');
 // Capture «ах» is already on the SFX bus. Do not inherit the announcer cut.
 expect(piece).toContain('play(yell, 1)');
 expect(piece).not.toContain('bark(yell');
 expect(audio).toContain('bindPieceSfx(sound)');
 expect(audio).toContain("sound('gate_stop')");
});
