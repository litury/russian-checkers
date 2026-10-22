import { PanelReveal } from '../../platform/browser/panelReveal';

export const menuDepartureMs = 2000;
export const repeatMenuDepartureMs = 900;

export class MenuTransition extends PanelReveal {
	constructor() {
		super(menuDepartureMs);
	}
}

export function animateMenuDeparture(root: HTMLElement, duration: number) {
	try {
		const animation = root.animate(
			[
				{ opacity: 1, transform: 'translateY(0)' },
				{ opacity: 0, transform: 'translateY(-12px)' },
			],
			{ duration, easing: 'ease-in-out', fill: 'both' },
		);
		return {
			get elapsed() {
				return Number(animation.currentTime ?? 0);
			},
			pause(paused: boolean) {
				if (paused && animation.playState === 'running') animation.pause();
				else if (!paused && animation.playState === 'paused') animation.play();
			},
			cancel() {
				animation.cancel();
			},
		};
	} catch {
		return null;
	}
}
