import { expect, it } from 'vitest';
import { gatePose } from './openingGates';
import { revealPose } from './panelReveal';
import {
 firstVisibleTimerLift,
 startPanelWindows,
 startTimerLock,
 startTimerSlide,
 startVoiceName,
 timerPanelClosedLift,
 timerSeated,
} from './startAudio';
import scene from './gameScene.ts?raw';
import overlay from './openingOverlay.ts?raw';
import audio from './menuAudio.ts?raw';
import bunker from './bunkerPanel.ts?raw';

it('binds panel-slide to existing HTML top/bottom motion, not gate_motion preview', () => {
 expect(startPanelWindows.map(w => w[0])).toEqual(['phrase-slide', 'title-lift']);
 expect(gatePose(401).slide).toBeGreaterThan(0);
 expect(gatePose(961).title).toBeGreaterThan(0);
 expect(audio).toContain('...startPanelWindows');
 expect(audio).not.toMatch(/\['phrase-slide',400,920,'gate_motion'/);
});

it('binds timer slide/lock to actual HUD lift, availability once, RU voice at ready', () => {
 expect(bunker).toContain('face.y = 10 + p.lift');
 expect(bunker).toContain('118 - go.y');
 expect(timerPanelClosedLift).toBe(108);
 expect(revealPose(860, false).lift).toBe(112);
 expect(startTimerSlide[0]).toBe(firstVisibleTimerLift());
 expect(startTimerSlide[0]).toBeGreaterThan(860);
 expect(revealPose(startTimerSlide[0] - 1, false).lift).toBeGreaterThanOrEqual(timerPanelClosedLift);
 expect(revealPose(startTimerSlide[0], false).lift).toBeLessThan(timerPanelClosedLift);
 expect(startTimerSlide[1]).toBe(startTimerLock[0]);
 expect(revealPose(startTimerLock[0], false).lift).toBe(0);
 expect(audio).toContain("startTimerSlide[0],startTimerSlide[1],'timer-slide'");
 expect(audio).not.toContain("['timer-slide',860");
 expect(audio).toContain('!reduced&&ms<end?sound');
 expect(audio).toContain("if(completed&&!reduced)sound('gate_stop')");
 expect(timerSeated(2479, false)).toBe(false);
 expect(timerSeated(2480, false)).toBe(true);
 expect(startVoiceName('ru')).toBe('start-ru');
 expect(startVoiceName('en-US')).toBe('start-en');
 expect(scene).toContain('hintWave');
 expect(overlay).toContain('hintWave');
 expect(audio).toContain('availability-wave');
 expect(scene).not.toContain('your move');
});
