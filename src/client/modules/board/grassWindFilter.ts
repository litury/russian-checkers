import Phaser from 'phaser';
import { tableLayers } from '@/client/config/layout';

/** Same as clock mounds: swap PNG frames. No Phaser filter (it froze the lawn). */
export function attachGrassWind(
	scene: Phaser.Scene,
	ground: Phaser.GameObjects.TileSprite,
): { active: boolean } | null {
	if (typeof scene.time?.addEvent !== 'function') {
		return null;
	}
	const ping = [0, 1, 2, 1] as const;
	let step = 0;
	scene.time.addEvent({
		delay: tableLayers.windHoldMs,
		loop: true,
		callback: () => {
			step = (step + 1) % ping.length;
			ground.setTexture(tableLayers.earthWind[ping[step]]);
		},
	});
	return { active: true };
}
