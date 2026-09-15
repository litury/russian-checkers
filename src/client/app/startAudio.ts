import { revealPose } from './panelReveal';

/** Scene-time windows from existing gatePose/CSS; do not retune animation. */
export const startPanelWindows = [
 ['phrase-slide', 400, 920, 'panel-slide', 1],
 ['title-lift', 960, 1400, 'panel-slide', 1],
] as const;

export const startTimerSlide = [860, 2480] as const;
export const startTimerLock = [2480, 2800] as const;

export function startVoiceName(lang = document.documentElement.lang): 'start-en' | 'start-ru' {
 return lang.toLowerCase().startsWith('en') ? 'start-en' : 'start-ru';
}

export function timerSeated(ms: number, reduced: boolean): boolean {
 return reduced || (revealPose(ms, false).lift === 0 && ms >= startTimerLock[0]);
}
