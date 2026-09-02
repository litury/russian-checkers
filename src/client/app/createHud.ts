import type Phaser from 'phaser';
import { createSfxPanel } from '@/client/app/parts/createSfxPanel';
import { computeFieldLayout, formatClock } from '@/client/config/fieldLayout';
import { layout } from '@/client/config/layout';
import { palette } from '@/client/config/palette';

const textStroke = '#1a1410';
const hudDepth = 12;
const menuDepth = 15;
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
	const sfxPanel = createSfxPanel(scene);
	menuHit.on('pointerdown', () => {
		sfxPanel.toggle();
	});

	function placeMenu(x: number, y: number): void {
		menuHit.setPosition(x, y);
		menuIcon.setPosition(x, y);
	}

	return {
		layout: (width, height) => {
			const field = computeFieldLayout(width, height);
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
