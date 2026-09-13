const duration = 720;
const unit = (t: number, a: number, b: number): number =>
	Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (t: number, a: number, b: number): number => {
	const u = unit(t, a, b);
	return u * u * (3 - 2 * u);
};
const swell = (t: number, a: number, b: number): number =>
	t <= a || t >= b ? 0 : Math.sin(Math.PI * unit(t, a, b)) ** 2;
/** Preview's emphasis sequence compressed to 720ms, with no initial/input hold. */
export function markerPhase(elapsed: number) {
	return {
		// Brightness only: continuous 2.4s breath starts at the exact final material.
		pulse:
			elapsed <= duration
				? 0
				: (1 - Math.cos(((elapsed - duration) * Math.PI * 2) / 2400)) / 2,
		radius: 19 - 1.6 * ease(elapsed, 0, 200),
		opening: 1.5 * ease(elapsed, 440, 680),
		amber: swell(elapsed, 0, 200) * 0.8,
		glint: swell(elapsed, 220, 420),
		progress: unit(elapsed, 220, 420),
		blue: swell(elapsed, 440, 720) * 0.75,
	};
}
export class MarkerMotion {
	elapsed = duration;
	private signature = '';
	private running = false;
	private pulse = true;
	get active(): boolean {
		return this.running;
	}
	sync(key: string, reduced: boolean, pulse = true): void {
		this.pulse = pulse;
		if (key !== this.signature) {
			this.signature = key;
			this.running = Boolean(key) && !reduced;
			this.elapsed = this.running ? 0 : duration;
		}
		if (reduced) {
			this.running = false;
			this.elapsed = duration;
		}
	}
	advance(delta: number, reduced: boolean): void {
		if (reduced) {
			this.running = false;
			this.elapsed = duration;
		} else if (this.running) {
			this.elapsed += Math.max(0, delta);
			if (!this.pulse && this.elapsed >= duration) {
				this.elapsed = duration;
				this.running = false;
			}
		}
	}
	cancel(): void {
		this.signature = '';
		this.running = false;
		this.elapsed = duration;
	}
}
