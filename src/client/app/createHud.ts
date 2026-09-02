import type Phaser from 'phaser';
import { computeFieldLayout, formatClock } from '@/client/config/fieldLayout';
import { layout } from '@/client/config/layout';
import { palette } from '@/client/config/palette';

const textStroke = '#1a1410';
const hudDepth = 12;
const pad = 12;

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

export function createHud(scene: Phaser.Scene): {
	layout: (width: number, height: number) => void;
	setTurn: (copy: string) => void;
	setTimer: (elapsedSec: number) => void;
} {
	const bar = scene.add.rectangle(0, 0, 8, layout.hudBar, 0x1a1410, 1);
	bar.setOrigin(0, 0);
	bar.setDepth(hudDepth - 1);
	bar.setVisible(false);
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
	menuHit.setDepth(hudDepth);
	menuHit.setInteractive();
	menuHit.on('pointerdown', () => undefined);
	const menuIcon = hudText(scene, '≡', '28px').setOrigin(0.5);

	function placeMenu(x: number, y: number): void {
		menuHit.setPosition(x, y);
		menuIcon.setPosition(x, y);
	}

	return {
		layout: (width, height) => {
			const field = computeFieldLayout(width, height);
			if (field.portrait) {
				bar.setVisible(true);
				bar.setPosition(0, 0);
				bar.setDisplaySize(width, layout.hudBar);
				const mid = layout.hudBar / 2;
				timer.setOrigin(0, 0.5).setPosition(pad, mid);
				turn.setOrigin(0.5, 0.5).setPosition(width / 2, mid);
				placeMenu(width - layout.hudMenu / 2, mid);
				return;
			}
			bar.setVisible(false);
			timer.setOrigin(0, 0);
			turn.setOrigin(0, 0);
			turn.setPosition(pad, pad);
			timer.setPosition(pad, pad + 28);
			placeMenu(width - pad - layout.hudMenu / 2, pad + layout.hudMenu / 2);
		},
		setTurn: (copy) => {
			turn.setText(copy);
		},
		setTimer: (elapsedSec) => {
			timer.setText(formatClock(elapsedSec));
		},
	};
}
