import type Phaser from 'phaser';
import { palette } from '@/client/config/palette';
import type { Side } from '@/rules';

export function createResultOverlay(
	scene: Phaser.Scene,
	onPlayAgain: () => void,
): { show: (side: Side) => void; hide: () => void } {
	const dim = scene.add.rectangle(0, 0, 16, 16, palette.overlay, 0.72);
	const panel = scene.add.rectangle(0, 0, 280, 160, palette.button);
	const title = scene.add
		.text(0, 0, '', {
			fontFamily: 'Arial, sans-serif',
			fontSize: '28px',
			color: palette.text,
		})
		.setOrigin(0.5);
	const button = scene.add.rectangle(0, 0, 180, 48, palette.darkSquare);
	const buttonLabel = scene.add
		.text(0, 0, 'Ещё раз', {
			fontFamily: 'Arial, sans-serif',
			fontSize: '22px',
			color: palette.text,
		})
		.setOrigin(0.5);
	button.setInteractive({ useHandCursor: true });
	button.on('pointerdown', () => {
		onPlayAgain();
	});
	const objects = [dim, panel, title, button, buttonLabel];
	for (const object of objects) {
		object.setDepth(20);
		object.setVisible(false);
	}

	function place(): void {
		const { width, height } = scene.scale;
		dim.setPosition(width / 2, height / 2);
		dim.setDisplaySize(width, height);
		panel.setPosition(width / 2, height / 2);
		title.setPosition(width / 2, height / 2 - 36);
		button.setPosition(width / 2, height / 2 + 36);
		buttonLabel.setPosition(width / 2, height / 2 + 36);
	}

	return {
		show: (side) => {
			place();
			title.setText(side === 'white' ? 'Вы выиграли' : 'Вы проиграли');
			for (const object of objects) {
				object.setVisible(true);
			}
		},
		hide: () => {
			for (const object of objects) {
				object.setVisible(false);
			}
		},
	};
}
