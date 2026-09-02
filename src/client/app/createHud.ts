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

	function tweenScaleY(scaleY: number): void {
		const tweens = scene.tweens;
		if (tweens && typeof tweens.killTweensOf === 'function') {
			tweens.killTweensOf(menuIcon);
		}
		menuIcon.setScale(1, scaleY);
		if (tweens && typeof tweens.add === 'function') {
			tweens.add({
				targets: menuIcon,
				scaleY,
				duration: layout.pressMs,
				ease: 'Sine.easeOut',
			});
		}
	}

	function applyMenuPress(open: boolean): void {
		if (open) {
			return;
		}
		tweenScaleY(1);
	}

	const sfxPanel = createSfxPanel(scene, {
		onOpenChange: applyMenuPress,
	});
	menuHit.on('pointerdown', (pointer: { id?: number }) => {
		if (!sfxPanel.isOpen()) {
			tweenScaleY(layout.pressScaleY);
		}
		sfxPanel.toggle(pointer);
	});

	const action = layout.hudAction;
	const stripGap = 8;
	const resignPlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0.5);
	resignPlate.setDisplaySize(action, action);
	resignPlate.setDepth(hudDepth);
	resignPlate.setInteractive({ useHandCursor: true });
	const resignIcon = scene.add.image(0, 0, 'hudResign').setOrigin(0.5);
	resignIcon.setDisplaySize(action, action);
	resignIcon.setDepth(hudDepth + 1);
	resignIcon.setInteractive({ useHandCursor: true });
	const autoPlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0.5);
	autoPlate.setDisplaySize(action, action);
	autoPlate.setDepth(hudDepth);
	autoPlate.setInteractive({ useHandCursor: true });
	const autoIcon = scene.add.image(0, 0, 'hudAuto').setOrigin(0.5);
	autoIcon.setDisplaySize(action, action);
	autoIcon.setDepth(hudDepth + 1);
	autoIcon.setInteractive({ useHandCursor: true });

	function paintAuto(): void {
		autoIcon.setTexture(getAutoMove() ? 'hudAuto' : 'hudAutoOff');
	}

	function fireResign(): void {
		handlers.onResign?.();
	}

	function toggleAuto(): void {
		setAutoMove(!getAutoMove());
		paintAuto();
		handlers.onAutoChange?.();
	}

	paintAuto();
	resignPlate.on('pointerdown', fireResign);
	resignIcon.on('pointerdown', fireResign);
	autoPlate.on('pointerdown', toggleAuto);
	autoIcon.on('pointerdown', toggleAuto);

	function placeMenu(x: number, y: number): void {
		menuHit.setPosition(x, y);
		menuIcon.setPosition(x, y);
	}

	function placeStrip(width: number, height: number): void {
		const pairW = action * 2 + stripGap;
		const left = Math.round((width - pairW) / 2 + action / 2);
		const right = left + action + stripGap;
		const y = Math.round(height - action / 2);
		resignPlate.setPosition(left, y);
		resignIcon.setPosition(left, y);
		autoPlate.setPosition(right, y);
		autoIcon.setPosition(right, y);
		paintAuto();
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
