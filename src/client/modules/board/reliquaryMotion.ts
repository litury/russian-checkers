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
	get active(): boolean {
		return this.elapsed < duration;
	}
	sync(key: string, reduced: boolean): void {
		if (key !== this.signature) {
			this.signature = key;
			this.elapsed = key && !reduced ? 0 : duration;
		}
		if (reduced) this.elapsed = duration;
	}
	advance(delta: number, reduced: boolean): void {
		this.elapsed = reduced
			? duration
			: Math.min(duration, this.elapsed + Math.max(0, delta));
	}
	cancel(): void {
		this.signature = '';
		this.elapsed = duration;
	}
}
