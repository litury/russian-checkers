import { expect, it } from 'vitest';
import { orcArenaLine, orcTurnLine } from './orcTurn';
import scene from './gameScene.ts?raw';
import audio from './menuAudio.ts?raw';

it('never stacks a turn line on the arena shout, and uses capture lines instead of generics', () => {
 expect(orcTurnLine(true, true, false)).toBeNull();
 expect(orcTurnLine(true, true, true)).toBeNull();
 expect(orcTurnLine(false, true, false)).toBe('tvoy-hod');
 expect(orcTurnLine(false, true, true)).toBe('atakuy');
 expect(orcTurnLine(false, false, false)).toBe('hod-protivnika');
 expect(orcTurnLine(false, false, true)).toBe('zashchishchaysya');
 expect(orcArenaLine).toBe('arena-k-boyu');
});

it('plays К бою when the arena appears, not at clock-ready, and wires one line per turn event', () => {
 expect(scene).toContain('arenaVoice');
 expect(scene).toContain('startPanels');
 expect(scene).not.toMatch(/ready = \(\) => \{[^}]*readyVoice/s);
 expect(scene).toContain('speakOrcTurn');
 expect(audio).toContain('orcArenaLine');
 expect(audio).not.toContain('startVoiceName()');
});
