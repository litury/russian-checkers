import Phaser from 'phaser';
import { palette } from '@/client/config/palette';
import { GameScene } from './gameScene';
import { createYandexSdk } from './yandexSdk';

async function boot(): Promise<void> {
	const sdk = await createYandexSdk();
	new Phaser.Game({
		type: Phaser.AUTO,
		pixelArt: true,
		parent: 'game',
		backgroundColor: palette.background,
		scale: {
			mode: Phaser.Scale.RESIZE,
			parent: 'game',
			width: window.innerWidth,
			height: window.innerHeight,
		},
		audio: {
			noAudio: false,
		},
		scene: [GameScene],
		callbacks: {
			preBoot: (game) => {
				game.registry.set('sdk', sdk);
			},
		},
	});
}

void boot();
