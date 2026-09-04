import type Phaser from 'phaser';
import {
	createSfxPanel,
	getAutoMove,
	setAutoMove,
} from '@/client/app/parts/createSfxPanel';
import { hudFont } from '@/client/fonts/fonts';
import { formatClock } from '@/client/config/fieldLayout';
import { layout } from '@/client/config/layout';
import { palette } from '@/client/config/palette';

const textStroke = '#1a1410';
const hudDepth = 12;
const menuDepth = 15;
const pad = 24;

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
			fontFamily: hudFont,
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
	const timer = hudText(scene, '5', '38px');
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
		onResign: () => {
			handlers.onResign?.();
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
		const opening = !sfxPanel.isOpen();
		sfxPanel.toggle(pointer);
		playMenuAnim(opening);
	});

	const aiIcon = scene.add.image(0, 0, 'hudAi').setOrigin(0.5);
	aiIcon.setDisplaySize(layout.hudAiW, layout.hudAiH);
	aiIcon.setDepth(hudDepth + 1);
	aiIcon.setInteractive({ useHandCursor: true });

	let aiRestX = 0;
	let aiRestY = 0;

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
		icon.setDisplaySize(size, size);
	}

	function paintAi(): void {
		aiIcon.setTexture(getAutoMove() ? 'hudAi' : 'hudAiOff');
		aiIcon.setScale(1, 1);
		aiIcon.setDisplaySize(layout.hudAiW, layout.hudAiH);
	}

	function toggleAuto(): void {
		setAutoMove(!getAutoMove());
		paintAi();
		handlers.onAutoChange?.();
	}

	paintAi();
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

	function placeMenu(x: number, y: number): void {
		menuRestX = x;
		menuRestY = y;
		menuHit.setPosition(x, y);
		paintMenu();
	}

	function placeActions(menuX: number, menuY: number): void {
		aiRestX = menuX;
		aiRestY =
			menuY + layout.hudMenu / 2 + layout.hudActionGap + layout.hudAiH / 2;
		aiIcon.setPosition(aiRestX, aiRestY);
		paintAi();
	}

	function setHudVisible(on: boolean): void {
		timer.setVisible(on);
		turn.setVisible(on);
		menuHit.setVisible(on);
		menuIcon.setVisible(on);
		aiIcon.setVisible(on);
		if (!on) {
			sfxPanel.hide();
			clearMenuTimer();
			menuHeld = false;
			menuPhase = 'idle';
			menuHit.disableInteractive();
			aiIcon.disableInteractive();
			return;
		}
		menuHit.setInteractive({ useHandCursor: true });
		aiIcon.setInteractive({ useHandCursor: true });
		paintMenu();
	}

	return {
		layout: (width, height) => {
			const menuY = layout.hudBar / 2;
			const menuX = width - pad - layout.hudMenu / 2;
			timer.setOrigin(0, 0.5).setPosition(pad, menuY);
			turn.setOrigin(0, 0).setPosition(pad, menuY + layout.hudMenu / 2 + 4);
			placeMenu(menuX, menuY);
			placeActions(menuX, menuY);
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
