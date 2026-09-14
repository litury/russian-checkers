import Phaser from 'phaser';
import '@/client/fonts/fonts.css';
import { palette } from '@/client/config/palette';
import { GameScene } from './gameScene';
import { createYandexSdk, deferYandexSdk, loadPlatformScript } from './yandexSdk';

function boot(): void {
	const sdk = deferYandexSdk(loadPlatformScript().then(() => createYandexSdk()));
	new Phaser.Game({
		type: Phaser.AUTO,
		pixelArt: true,
		roundPixels: true,
		parent: 'game',
		backgroundColor: palette.background,
		scale: {
			// Public manual resize path: displayDensity owns CSS/backing density.
			mode: Phaser.Scale.NONE,
			parent: 'game',
			width: window.innerWidth,
			height: window.innerHeight,
		},
		audio: {
			noAudio: true,
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
