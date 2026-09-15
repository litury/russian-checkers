import { expect, it } from 'vitest';
import { orcArenaLine, orcOpeningTurnLine } from './orcTurn';
import scene from './gameScene.ts?raw';
import audio from './menuAudio.ts?raw';

it('prepares once then one color line, never every turn or attack lines', () => {
 expect(orcArenaLine).toBe('arena-k-boyu');
 expect(orcOpeningTurnLine('white')).toBe('tvoy-hod');
 expect(orcOpeningTurnLine('black')).toBe('hod-protivnika');
 expect(scene).toContain('orcOpeningTurnLine');
 expect(scene).not.toContain('atakuy');
 expect(scene).not.toContain('zashchishchaysya');
 expect(audio).toContain('orcArenaLine');
});
