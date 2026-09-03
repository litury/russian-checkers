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

type HudHandlers = {
	onResign?: () => void;
	onAutoChange?: () => void;
};

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
	let menuPressTimer: { remove: (dispatch?: boolean) => void } | undefined;

	function paintMenu(): void {
		menuIcon.setScale(1, 1);
		if (menuHeld) {
			menuIcon.setTexture('hudMenuPress');
		} else if (sfxPanel.isOpen()) {
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

	function holdMenuPress(): void {
		menuHeld = true;
		paintMenu();
		menuPressTimer?.remove(false);
		menuPressTimer = scene.time.delayedCall(layout.pressMs, () => {
			menuHeld = false;
			menuPressTimer = undefined;
			paintMenu();
		});
	}

	menuHit.on('pointerdown', (pointer: { id?: number }) => {
		disarmResign();
		menuHeld = true;
		sfxPanel.toggle(pointer);
		holdMenuPress();
	});

	const action = layout.hudAction;
	const moat = scene.add.image(0, 0, 'hudActionMoat').setOrigin(0, 0);
	moat.setDisplaySize(layout.hudMoatW, layout.hudMoatH);
	moat.setDepth(hudDepth);
	const resignIcon = scene.add.image(0, 0, 'hudResign').setOrigin(0.5);
	resignIcon.setDisplaySize(action, action);
	resignIcon.setDepth(hudDepth + 1);
	resignIcon.setInteractive({ useHandCursor: true });
	const aiIcon = scene.add.image(0, 0, 'hudAi').setOrigin(0.5);
	aiIcon.setDisplaySize(action, action);
	aiIcon.setDepth(hudDepth + 1);
	aiIcon.setInteractive({ useHandCursor: true });

	let resignRestX = 0;
	let resignRestY = 0;
	let aiRestX = 0;
	let aiRestY = 0;
	let resignArmed = false;
	let resignCatcherArmed = false;
	let resignArmTimer: { remove: (dispatch?: boolean) => void } | undefined;
	let resignCatcherTimer: { remove: (dispatch?: boolean) => void } | undefined;

	function juiceIcon(
		icon: Phaser.GameObjects.Image,
		restX: () => number,
		restY: () => number,
		down: boolean,
	): void {
		const dip = down ? dipPx(action) : 0;
		icon.setPosition(restX(), restY() + dip);
		icon.setScale(1, 1);
	}

	function paintAi(): void {
		aiIcon.setTexture(getAutoMove() ? 'hudAi' : 'hudAiOff');
		aiIcon.setScale(1, 1);
	}

	function paintResign(): void {
		resignIcon.setTexture(resignArmed ? 'hudResignWave' : 'hudResign');
		resignIcon.setScale(1, 1);
	}

	function juiceResign(down: boolean): void {
		juiceIcon(
			resignIcon,
			() => resignRestX,
			() => resignRestY,
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

	paintAi();
	resignIcon.on('pointerdown', onResignDown);
	resignIcon.on('pointerup', onResignUp);
	resignIcon.on('pointerout', onResignUp);
	aiIcon.on('pointerdown', () => {
		juiceIcon(
			aiIcon,
			() => aiRestX,
			() => aiRestY,
			true,
		);
		toggleAuto();
	});
	aiIcon.on('pointerup', () => {
		juiceIcon(
			aiIcon,
			() => aiRestX,
			() => aiRestY,
			false,
		);
	});
	aiIcon.on('pointerout', () => {
		juiceIcon(
			aiIcon,
			() => aiRestX,
			() => aiRestY,
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
	};
}
