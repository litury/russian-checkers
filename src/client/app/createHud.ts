import type Phaser from 'phaser';
import {
	createSfxPanel,
	getAutoMove,
	setAutoMove,
} from '@/client/app/parts/createSfxPanel';
import { clockFontPx, hudFont, whenHudFontReady } from '@/client/fonts/fonts';
import {
	clockHudLayout,
	computeFieldLayout,
	formatClock,
	hudClockEH,
	hudClockEW,
} from '@/client/config/fieldLayout';
import { layout } from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import { blitzStartMs, type Side } from '@/rules';

export const hudClockEIdleKey = 'hudClockEIdle';
export const hudClockEHotKey = 'hudClockEHot';
export { hudClockEW, hudClockEH } from '@/client/config/fieldLayout';
export const hudClockFaceKey = 'hudClockFace';
export const hudClockFaceSize = 96;
export const hudClockHubDx = 4;
export const hudClockHubDy = 2;
export const hudClockWellR = 22;
export const hudClockTicks = 3;
export const hudClockMarks = 12;
export const hudClockNeedle = 0xa68e63;

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
	setClock: (whiteSec: number, blackSec: number, turn?: Side | null) => void;
	setHand: (remainingMs: number, lap?: number) => void;
	setVisible: (on: boolean) => void;
} {
	const face = scene.add
		.image(0, 0, hudClockFaceKey)
		.setOrigin(0.5)
		.setDisplaySize(hudClockFaceSize, hudClockFaceSize)
		.setDepth(hudDepth);
	const needle = scene.add.graphics();
	needle.setDepth(hudDepth + 1);
	face.setVisible(false);
	needle.setVisible(false);
	const foeShell = scene.add
		.image(0, 0, hudClockEIdleKey)
		.setOrigin(0, 1)
		.setDisplaySize(hudClockEW, hudClockEH)
		.setDepth(hudDepth);
	const youShell = scene.add
		.image(0, 0, hudClockEIdleKey)
		.setOrigin(1, 1)
		.setDisplaySize(hudClockEW, hudClockEH)
		.setDepth(hudDepth);
	const clockStyle = {
		fontFamily: hudFont,
		fontSize: `${clockFontPx}px`,
		color: palette.text,
	};
	const foeClock = scene.add
		.text(0, 0, '', clockStyle)
		.setOrigin(0.5)
		.setDepth(hudDepth + 1)
		.setVisible(false);
	const youClock = scene.add
		.text(0, 0, '', clockStyle)
		.setOrigin(0.5)
		.setDepth(hudDepth + 1)
		.setVisible(false);
	const labelStyle = {
		fontFamily: hudFont,
		fontSize: '10px',
		color: palette.text,
	};
	const foeLabel = scene.add
		.text(0, 0, 'Бот', labelStyle)
		.setOrigin(0.5, 1)
		.setDepth(hudDepth + 1)
		.setVisible(false);
	const youLabel = scene.add
		.text(0, 0, 'Ты', labelStyle)
		.setOrigin(0.5, 1)
		.setDepth(hudDepth + 1)
		.setVisible(false);
	let clockFontReady = false;
	whenHudFontReady(() => {
		clockFontReady = true;
		foeClock.setFontFamily(hudFont);
		youClock.setFontFamily(hudFont);
		foeLabel.setFontFamily(hudFont);
		youLabel.setFontFamily(hudFont);
		foeClock.setFontSize(clockFontPx);
		youClock.setFontSize(clockFontPx);
		foeClock.setText(foeClock.text || '60');
		youClock.setText(youClock.text || '60');
		foeClock.setVisible(true);
		youClock.setVisible(true);
		foeLabel.setVisible(true);
		youLabel.setVisible(true);
	});
	let hubX = 0;
	let hubY = 0;
	const turn = hudText(scene, '', '16px');
	turn.setVisible(false);
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

	let handLap = 0;

	function paintHand(remainingMs: number, lap = handLap): void {
		handLap = lap;
		const t = 1 - Math.max(0, Math.min(blitzStartMs, remainingMs)) / blitzStartMs;
		const sweep = (hudClockTicks * Math.PI * 2) / hudClockMarks;
		const angle = -Math.PI / 2 + (handLap + t) * sweep;
		const tipX = hubX + Math.cos(angle) * hudClockWellR;
		const tipY = hubY + Math.sin(angle) * hudClockWellR;
		needle.clear();
		needle.lineStyle(2, hudClockNeedle, 1);
		needle.lineBetween(hubX, hubY, tipX, tipY);
	}

	function setHudVisible(on: boolean): void {
		face.setVisible(false);
		needle.setVisible(false);
		foeClock.setVisible(on && clockFontReady);
		youClock.setVisible(on && clockFontReady);
		foeLabel.setVisible(on && clockFontReady);
		youLabel.setVisible(on && clockFontReady);
		foeShell.setVisible(on);
		youShell.setVisible(on);
		turn.setVisible(false);
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
			const field = computeFieldLayout(width, height);
			const menuY = layout.hudBar / 2;
			const menuX = width - pad - layout.hudMenu / 2;
			face.setVisible(false);
			needle.setVisible(false);
			const clocks = clockHudLayout(width, height, field);
			foeShell.setOrigin(clocks.foe.originX, clocks.foe.originY);
			youShell.setOrigin(clocks.you.originX, clocks.you.originY);
			foeShell.setPosition(clocks.foe.x, clocks.foe.y);
			youShell.setPosition(clocks.you.x, clocks.you.y);
			foeShell.setDisplaySize(hudClockEW, hudClockEH);
			youShell.setDisplaySize(hudClockEW, hudClockEH);
			foeClock.setPosition(clocks.foeDigit.x, clocks.foeDigit.y);
			youClock.setPosition(clocks.youDigit.x, clocks.youDigit.y);
			foeLabel.setPosition(clocks.foeLabel.x, clocks.foeLabel.y);
			youLabel.setPosition(clocks.youLabel.x, clocks.youLabel.y);
			placeMenu(menuX, menuY);
			placeActions(menuX, menuY);
			sfxPanel.layout(menuX, menuY, width, height);
		},
		setTurn: (copy) => {
			turn.setText('');
			void copy;
		},
		setTimer: (_elapsedSec) => {},
		setClock: (whiteSec, blackSec, turn = 'white') => {
			youClock.setText(formatClock(whiteSec));
			foeClock.setText(formatClock(blackSec));
			youShell.setTexture(
				turn && turn !== 'white' ? hudClockEHotKey : hudClockEIdleKey,
			);
			foeShell.setTexture(
				turn && turn !== 'black' ? hudClockEHotKey : hudClockEIdleKey,
			);
			youShell.setDisplaySize(hudClockEW, hudClockEH);
			foeShell.setDisplaySize(hudClockEW, hudClockEH);
		},
		setHand: (remainingMs, lap = 0) => {
			paintHand(remainingMs, lap);
		},
		setVisible: (on) => {
			setHudVisible(on);
		},
	};
}
