import { revealPose } from './panelReveal';

/** Scene-time windows from existing gatePose/CSS; do not retune animation. */
export const startPanelWindows = [
 ['phrase-slide', 400, 920, 'panel-slide', 1],
 ['title-lift', 960, 1400, 'panel-slide', 1],
] as const;

export const startTimerLock = [2480, 2800] as const;
/**
 * Bunker face sits at y=10+lift inside the [10,128) mask, so lift >= 108 is
 * still fully closed. Smootherstep's derivative is zero at the 860ms origin.
 */
export const timerPanelClosedLift = 108;

export function firstVisibleTimerLift(): number {
 for (let ms = 0; ms <= startTimerLock[0]; ms++) {
  if (revealPose(ms, false).lift < timerPanelClosedLift) return ms;
 }
 return startTimerLock[0];
}

/** Attack at the first visible lift pixel, not the mathematical curve zero. */
export const startTimerSlide = [firstVisibleTimerLift(), startTimerLock[0]] as const;

export function startVoiceName(lang = document.documentElement.lang): 'start-en' | 'start-ru' {
 return lang.toLowerCase().startsWith('en') ? 'start-en' : 'start-ru';
}

export function timerSeated(ms: number, reduced: boolean): boolean {
 return reduced || (revealPose(ms, false).lift === 0 && ms >= startTimerLock[0]);
}
