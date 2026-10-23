export const panelDurationMs = 240;

export class PanelReveal {
	elapsed: number;
	constructor(public duration = panelDurationMs) {
		this.elapsed = duration;
	}
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
