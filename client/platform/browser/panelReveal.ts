export const preparationMs = 2800;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** The approved local timeline, sampled by Phaser's scene update. No independent timers. */
export function revealPose(ms: number, reduced: boolean) {
	if (reduced) return { lift: 0, doors: 181, steam: -1, light: 0 };
	const d = clamp((ms - 120) / 1020),
		p = clamp((ms - 860) / 1620);
	return {
		doors: Math.round(181 * d * d * (3 - 2 * d)),
		lift: Math.round(112 * (1 - (6 * p ** 5 - 15 * p ** 4 + 10 * p ** 3))),
		steam:
			ms >= 120 && ms < 720
				? Math.min(17, Math.floor(((ms - 120) * 30) / 1000))
				: -1,
		light:
			ms > 2480 && ms < 2800
				? Math.sin((Math.PI * (ms - 2480)) / 320) * 0.7
				: 0,
	};
}
export class PanelReveal {
	constructor(public duration = preparationMs) {}
	elapsed = preparationMs;
	private done?: () => void;
	get active() {
		return this.done !== undefined;
	}
	start(done: () => void) {
		this.elapsed = 0;
		this.done = done;
	}
	cancel() {
		this.done = undefined;
	}
	advance(delta: number, paused = false) {
		if (!this.done || paused) return;
		this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, delta));
		if (this.elapsed === this.duration) {
			const done = this.done;
			this.done = undefined;
			done();
		}
	}
}
