import { PanelReveal } from '../../platform/browser/panelReveal';

export const menuDepartureMs = 420;
export const repeatMenuDepartureMs = 280;

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
				{ opacity: 0, transform: 'translateY(-6px)' },
			],
			{ duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
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
