import { PanelReveal, preparationMs } from './panelReveal';
const ease = (n: number) => { const x = Math.max(0, Math.min(1, n)); return x*x*(3-2*x); };
/** v4 choreography, normalized so resize never resets the animation. */
export function gatePose(ms: number) {
 const t = ms / preparationMs;
 return { press: ease(t/.10), slide: ease((t-.20)/.26), title: ease((t-.48)/.22), doors: ease((t-.58)/.42) };
}
/** Shared scene-time lifecycle with the clock panels; no wall-clock timers. */
export class OpeningGates extends PanelReveal {}
