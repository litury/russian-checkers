import { expect, it } from 'vitest';
import { announcerCue, elfArenaLine } from './announcer';
import { orcArenaLine } from './orcTurn';
import scene from './gameScene.ts?raw';
import audio from './menuAudio.ts?raw';

it('uses elf lines when human is white and orc when black, no color UI', () => {
 expect(announcerCue('white', orcArenaLine)).toBe(elfArenaLine);
 expect(announcerCue('white', 'tvoy-hod')).toBe('elf-tvoy-hod');
 expect(announcerCue('white', 'time-low')).toBe('elf-time-low');
 expect(announcerCue('white', 'victory')).toBe('elf-victory');
 expect(announcerCue('black', orcArenaLine)).toBe(orcArenaLine);
 expect(announcerCue('black', 'hod-protivnika')).toBe('hod-protivnika');
 expect(scene).toContain('this.humanSide');
 expect(audio).toContain('announcerCue');
 expect(scene).not.toContain('color-select');
 expect(scene).toContain("humanSide: Side = 'white'");
});
