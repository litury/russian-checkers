import type Phaser from 'phaser';
import {
	createSfxPanel,
	getAutoMove,
	setAutoMove,
} from '@/client/app/parts/createSfxPanel';
import { computeFieldLayout, formatClock } from '@/client/config/fieldLayout';
import { layout } from '@/client/config/layout';
import { palette } from '@/client/config/palette';

const textStroke = '#1a1410';
const hudDepth = 12;
const menuDepth = 15;
const pad = 12;

export const resignArmMs = 2000;
export const resignWaveGapMs = 5600;
export const resignWaveHoldMs = 220;

type HudHandlers = {
	onResign?: () => void;
	onAutoChange?: () => void;
};

type MenuPhase = 'idle' | 'press' | 'fold' | 'open';

function prefersReducedMotion(): boolean {
	try {
		return Boolean(
			globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
		);
	} catch {
		return false;
	}
}

function hudText(
	scene: Phaser.Scene,
	content: string,
	fontSize: string,
): Phaser.GameObjects.Text {
	return scene.add
		.text(0, 0, content, {
			fontFamily: 'Arial, sans-serif',
			fontSize,
			color: palette.text,
		})
		.setStroke(textStroke, 2)
		.setDepth(hudDepth);
}

function dipPx(size: number): number {
	return Math.round(size * layout.pressDipRatio);
}

export function createHud(
	scene: Phaser.Scene,
	handlers: HudHandlers = {},
): {
	layout: (width: number, height: number) => void;
	setTurn: (copy: string) => void;
	setTimer: (elapsedSec: number) => void;
	setVisible: (on: boolean) => void;
} {
	const timer = hudText(scene, '0:00', '20px');
	const turn = hudText(scene, '', '20px');
	const menuHit = scene.add.rectangle(
		0,
		0,
		layout.hudMenu,
		layout.hudMenu,
		0x000000,
		0,
	);
	menuHit.setDepth(menuDepth);
	menuHit.setInteractive({ useHandCursor: true });
	const menuIcon = scene.add
		.image(0, 0, 'hudMenu')
		.setOrigin(0.5)
		.setDisplaySize(layout.hudMenu, layout.hudMenu)
		.setDepth(menuDepth);

	let menuRestX = 0;
	let menuRestY = 0;
	let menuHeld = false;
	let menuPhase: MenuPhase = 'idle';
	let menuAnimTimer: { remove: (dispatch?: boolean) => void } | undefined;

	function paintMenu(): void {
		menuIcon.setScale(1, 1);
		if (menuHeld || menuPhase === 'press') {
			menuIcon.setTexture('hudMenuPress');
		} else if (menuPhase === 'fold') {
			menuIcon.setTexture('hudMenuFold');
		} else if (menuPhase === 'open' || sfxPanel.isOpen()) {
			menuIcon.setTexture('hudMenuOpen');
		} else {
			menuIcon.setTexture('hudMenu');
		}
		menuIcon.setPosition(menuRestX, menuRestY);
		menuIcon.setDisplaySize(layout.hudMenu, layout.hudMenu);
	}

	const sfxPanel = createSfxPanel(scene, {
		onOpenChange: () => {
			paintMenu();
		},
	});

	function clearMenuTimer(): void {
		menuAnimTimer?.remove(false);
		menuAnimTimer = undefined;
	}

	function finishMenu(open: boolean): void {
		menuHeld = false;
		menuPhase = open ? 'open' : 'idle';
		menuAnimTimer = undefined;
		paintMenu();
	}

	function playMenuAnim(open: boolean): void {
		clearMenuTimer();
		if (prefersReducedMotion()) {
			finishMenu(open);
			return;
		}
		menuHeld = true;
		menuPhase = 'press';
		paintMenu();
		menuAnimTimer = scene.time.delayedCall(layout.pressMs, () => {
			menuHeld = false;
			menuPhase = 'fold';
			paintMenu();
			menuAnimTimer = scene.time.delayedCall(layout.menuFoldMs, () => {
				finishMenu(open);
			});
		});
	}

	menuHit.on('pointerdown', (pointer: { id?: number }) => {
		disarmResign();
		const opening = !sfxPanel.isOpen();
		sfxPanel.toggle(pointer);
		playMenuAnim(opening);
	});

	const resignSize = layout.hudResign;
	const moat = scene.add.image(0, 0, 'hudActionMoat').setOrigin(0, 0);
	moat.setDisplaySize(layout.hudMoatW, layout.hudMoatH);
	moat.setDepth(hudDepth);
	const resignIcon = scene.add.image(0, 0, 'hudResign').setOrigin(0.5);
	resignIcon.setDisplaySize(resignSize, resignSize);
	resignIcon.setDepth(hudDepth + 1);
	resignIcon.setInteractive({ useHandCursor: true });
	const aiIcon = scene.add.image(0, 0, 'hudAi').setOrigin(0.5);
	aiIcon.setDisplaySize(layout.hudAiW, layout.hudAiH);
	aiIcon.setDepth(hudDepth + 1);
	aiIcon.setInteractive({ useHandCursor: true });

	let resignRestX = 0;
	let resignRestY = 0;
	let aiRestX = 0;
	let aiRestY = 0;
	let resignArmed = false;
	let resignCatcherArmed = false;
	let resignIdleWave = false;
	let resignArmTimer: { remove: (dispatch?: boolean) => void } | undefined;
	let resignCatcherTimer: { remove: (dispatch?: boolean) => void } | undefined;
	let resignWaveTimer: { remove: (dispatch?: boolean) => void } | undefined;

	function juiceIcon(
		icon: Phaser.GameObjects.Image,
		restX: () => number,
		restY: () => number,
		size: number,
		down: boolean,
	): void {
		const dip = down ? dipPx(size) : 0;
		icon.setPosition(restX(), restY() + dip);
		icon.setScale(1, 1);
	}

	function paintAi(): void {
		aiIcon.setTexture(getAutoMove() ? 'hudAi' : 'hudAiOff');
		aiIcon.setScale(1, 1);
		aiIcon.setDisplaySize(layout.hudAiW, layout.hudAiH);
	}

	function paintResign(): void {
		resignIcon.setTexture(
			resignArmed || resignIdleWave ? 'hudResignWave' : 'hudResign',
		);
		resignIcon.setScale(1, 1);
		resignIcon.setDisplaySize(resignSize, resignSize);
	}

	function juiceResign(down: boolean): void {
		juiceIcon(
			resignIcon,
			() => resignRestX,
			() => resignRestY,
			resignSize,
			down,
		);
		paintResign();
	}

	function fireResign(): void {
		handlers.onResign?.();
	}

	function disarmResign(): void {
		if (!resignArmed) {
			return;
		}
		resignArmed = false;
		resignCatcherArmed = false;
		resignArmTimer?.remove(false);
		resignArmTimer = undefined;
		resignCatcherTimer?.remove(false);
		resignCatcherTimer = undefined;
		juiceResign(false);
	}

	function armResignCatcher(): void {
		resignCatcherArmed = true;
	}

	function onResignDown(): void {
		juiceIcon(
			resignIcon,
			() => resignRestX,
			() => resignRestY,
			resignSize,
			true,
		);
		if (resignArmed) {
			resignArmed = false;
			resignCatcherArmed = false;
			resignArmTimer?.remove(false);
			resignArmTimer = undefined;
			resignCatcherTimer?.remove(false);
			resignCatcherTimer = undefined;
			fireResign();
			juiceResign(false);
			return;
		}
		resignArmed = true;
		resignCatcherArmed = false;
		paintResign();
		resignArmTimer?.remove(false);
		resignCatcherTimer?.remove(false);
		resignArmTimer = scene.time.delayedCall(resignArmMs, () => {
			resignArmed = false;
			resignCatcherArmed = false;
			resignArmTimer = undefined;
			resignCatcherTimer = undefined;
			juiceResign(false);
		});
		resignCatcherTimer = scene.time.delayedCall(0, armResignCatcher);
	}

	function onResignUp(): void {
		if (resignArmed) {
			return;
		}
		juiceResign(false);
	}

	function toggleAuto(): void {
		disarmResign();
		setAutoMove(!getAutoMove());
		paintAi();
		handlers.onAutoChange?.();
	}

	function scheduleIdleWave(): void {
		resignWaveTimer?.remove(false);
		resignWaveTimer = scene.time.delayedCall(resignWaveGapMs, () => {
			resignIdleWave = true;
			paintResign();
			resignWaveTimer = scene.time.delayedCall(resignWaveHoldMs, () => {
				resignIdleWave = false;
				paintResign();
				scheduleIdleWave();
			});
		});
	}

	paintAi();
	scheduleIdleWave();
	resignIcon.on('pointerdown', onResignDown);
	resignIcon.on('pointerup', onResignUp);
	resignIcon.on('pointerout', onResignUp);
	aiIcon.on('pointerdown', () => {
		juiceIcon(
			aiIcon,
			() => aiRestX,
			() => aiRestY,
			layout.hudAiH,
			true,
		);
		toggleAuto();
	});
	aiIcon.on('pointerup', () => {
		juiceIcon(
			aiIcon,
			() => aiRestX,
			() => aiRestY,
			layout.hudAiH,
			false,
		);
	});
	aiIcon.on('pointerout', () => {
		juiceIcon(
			aiIcon,
			() => aiRestX,
			() => aiRestY,
			layout.hudAiH,
			false,
		);
	});

	scene.input.on(
		'pointerdown',
		(_pointer: unknown, currentlyOver?: unknown[]) => {
			if (!resignArmed || !resignCatcherArmed) {
				return;
			}
			const over = currentlyOver ?? [];
			if (over.includes(resignIcon)) {
				return;
			}
			disarmResign();
		},
	);

	function placeMenu(x: number, y: number): void {
		menuRestX = x;
		menuRestY = y;
		menuHit.setPosition(x, y);
		paintMenu();
	}

	function placeStrip(width: number, height: number): void {
		const moatX = Math.round((width - layout.hudMoatW) / 2);
		const moatY = Math.round(height - layout.hudStripInset - layout.hudMoatH);
		moat.setPosition(moatX, moatY);
		moat.setDisplaySize(layout.hudMoatW, layout.hudMoatH);
		resignRestX = moatX + layout.hudMoatResignX;
		resignRestY = moatY + layout.hudMoatResignY;
		aiRestX = moatX + layout.hudMoatAiX;
		aiRestY = moatY + layout.hudMoatAiY;
		resignIcon.setPosition(resignRestX, resignRestY);
		aiIcon.setPosition(aiRestX, aiRestY);
		paintAi();
		paintResign();
	}

	function setHudVisible(on: boolean): void {
		timer.setVisible(on);
		turn.setVisible(on);
		menuHit.setVisible(on);
		menuIcon.setVisible(on);
		moat.setVisible(on);
		resignIcon.setVisible(on);
		aiIcon.setVisible(on);
		if (!on) {
			sfxPanel.hide();
			clearMenuTimer();
			menuHeld = false;
			menuPhase = 'idle';
			menuHit.disableInteractive();
			resignIcon.disableInteractive();
			aiIcon.disableInteractive();
			return;
		}
		menuHit.setInteractive({ useHandCursor: true });
		resignIcon.setInteractive({ useHandCursor: true });
		aiIcon.setInteractive({ useHandCursor: true });
		paintMenu();
	}

	return {
		layout: (width, height) => {
			const field = computeFieldLayout(width, height);
			placeStrip(width, height);
			if (field.portrait) {
				const mid = layout.hudBar / 2;
				timer.setOrigin(0, 0.5).setPosition(pad, mid);
				turn.setOrigin(0.5, 0.5).setPosition(width / 2, mid);
				const menuX = width - layout.hudMenu / 2;
				placeMenu(menuX, mid);
				sfxPanel.layout(menuX, mid, width, height);
				return;
			}
			timer.setOrigin(0, 0);
			turn.setOrigin(0, 0);
			turn.setPosition(pad, pad);
			timer.setPosition(pad, pad + 28);
			const menuX = width - pad - layout.hudMenu / 2;
			const menuY = pad + layout.hudMenu / 2;
			placeMenu(menuX, menuY);
			sfxPanel.layout(menuX, menuY, width, height);
		},
		setTurn: (copy) => {
			turn.setText(copy);
		},
		setTimer: (elapsedSec) => {
			timer.setText(formatClock(elapsedSec));
		},
		setVisible: (on) => {
			setHudVisible(on);
		},
	};
}
