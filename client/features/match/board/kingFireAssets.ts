import type Phaser from 'phaser';

import sheets from './kingFireSheets.json';
export const kingFireSheets = sheets;
export type KingFireSheet = keyof typeof sheets;
/** Restore the previously shipped contour layers unchanged. */
export const kingFireAssets = {
	'idle-back': new URL('./king-fire-polish/idle-back.webp', import.meta.url)
		.href,
	'idle-front': new URL('./king-fire-polish/idle-front.webp', import.meta.url)
		.href,
	'ignite-back': new URL('./king-fire-polish/ignite-back.webp', import.meta.url)
		.href,
	'ignite-front': new URL(
		'./king-fire-polish/ignite-front.webp',
		import.meta.url,
	).href,
	trail: new URL('./king-fire/trail.webp', import.meta.url).href,
	static: new URL('./king-fire/static.webp', import.meta.url).href,
};
export function kingFireTextureReady(
	scene: Phaser.Scene,
	name: string,
): boolean {
	const key = `king-fire_${name}`;
	if (!scene.textures.exists(key)) return false;
	const texture = scene.textures.get(key);
	return (
		texture.frameTotal === kingFireSheets[name as KingFireSheet]?.frames + 1
	);
}
export function preloadKingFire(scene: Phaser.Scene): void {
	const missing = Object.entries(kingFireAssets).filter(
		([name]) => !scene.textures.exists(`king-fire_${name}`),
	);
	if (!missing.length) return;
	const failed = (file: { key?: string }) => {
		if (file.key?.startsWith('king-fire_'))
			console.error('[king-fire] sheet load failed', file.key);
	};
	scene.load.on('loaderror', failed);
	const complete = () => {
		scene.load.off('loaderror', failed);
		scene.events.off('shutdown', cleanup);
		for (const name of Object.keys(kingFireAssets))
			if (!kingFireTextureReady(scene, name))
				console.error(
					'[king-fire] missing or incomplete sheet',
					`king-fire_${name}`,
					`expected ${kingFireSheets[name as KingFireSheet].frames} frames`,
				);
	};
	const cleanup = () => {
		scene.load.off('loaderror', failed);
		scene.load.off('complete', complete);
	};
	scene.load.once('complete', complete);
	scene.events.once('shutdown', cleanup);
	for (const [name, url] of missing) {
		const sheet = kingFireSheets[name as KingFireSheet];
		scene.load.spritesheet(`king-fire_${name}`, url, {
			frameWidth: sheet.width,
			frameHeight: sheet.height,
			endFrame: sheet.frames - 1,
		});
	}
}
