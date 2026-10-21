import type { IPosition } from '@/shared/rules';
import { type BotSkill, pickBotMove } from './pickBotMove';

interface ScheduledTurn {
	remove(dispatch?: boolean): void;
}

export class BotTurn {
	pending = false;
	private timer?: ScheduledTurn;
	private generation = 0;

	constructor(
		private delay: (
			milliseconds: number,
			callback: () => void,
		) => ScheduledTurn,
	) {}

	schedule(callback: () => void): void {
		this.cancel();
		const generation = this.generation;
		this.timer = this.delay(400, () => {
			this.timer = undefined;
			if (generation === this.generation) callback();
		});
	}

	choose(position: IPosition, skill: BotSkill) {
		return pickBotMove(position, Math.random, skill);
	}

	cancel(): void {
		this.generation += 1;
		this.timer?.remove(false);
		this.timer = undefined;
		this.pending = false;
	}
}
