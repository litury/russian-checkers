import { PanelReveal } from './panelReveal';
export const gateDurationMs = 2000;
/** Later matches in one session compress the same choreography; the first keeps it full. */
export const repeatGateDurationMs = 900;
export const panelDurationMs = 1200;
const ease = (n: number) => { const x = Math.max(0, Math.min(1, n)); return x*x*(3-2*x); };
/** v4 choreography, normalized so resize never resets the animation. */
export function gatePose(ms: number, duration = gateDurationMs) {
 const t = ms / duration;
 return { press: ease(t/.10), slide: ease((t-.20)/.26), title: ease((t-.48)/.22), doors: ease((t-.58)/.42) };
}
/** Shared scene-time lifecycle with the clock panels; no wall-clock timers. */
export class OpeningGates extends PanelReveal {
 constructor(duration = gateDurationMs) { super(duration); }
}
