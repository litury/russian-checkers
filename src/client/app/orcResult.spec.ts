import { expect, it } from 'vitest';
import { orcOutcomeLine, orcTimeLow, orcTimeLowMs } from './orcResult';
import scene from './gameScene.ts?raw';

it('says time-low once under 10s on the player clock, never a tick', () => {
 expect(orcTimeLowMs).toBe(10_000);
 expect(orcTimeLow(9999, false)).toBe(true);
 expect(orcTimeLow(9999, true)).toBe(false);
 expect(orcTimeLow(10_000, false)).toBe(false);
 expect(orcTimeLow(0, false)).toBe(false);
 expect(scene).toContain('orcTimeLow');
});

it('picks one outcome line: flag time-up or victory, other losses defeat, never both', () => {
 expect(orcOutcomeLine('flag', false)).toBe('time-up');
 expect(orcOutcomeLine('flag', true)).toBe('victory');
 expect(orcOutcomeLine('rules', true)).toBe('victory');
 expect(orcOutcomeLine('rules', false)).toBe('defeat');
 expect(orcOutcomeLine('resign', false)).toBe('defeat');
 expect(scene).toContain('speakOrcTurn');
 expect(scene).toContain('orcOutcomeLine');
});
