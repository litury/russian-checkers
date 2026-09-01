import type Phaser from 'phaser';

export const sfxKeys = {
	select: 'sfxSelect',
	move: 'sfxMove',
	capture: 'sfxCapture',
} as const;

export type TableSfxKind = keyof typeof sfxKeys;

export function preloadTableSfx(
	scene: Phaser.Scene,
	urls: Record<TableSfxKind, string>,
): void {
	const loader = scene.load as Phaser.Loader.LoaderPlugin & {
		audio: (key: string, url: string) => void;
	};
	loader.audio(sfxKeys.select, urls.select);
	loader.audio(sfxKeys.move, urls.move);
	loader.audio(sfxKeys.capture, urls.capture);
}

export function createTableSfx(scene: Phaser.Scene): {
	play: (kind: TableSfxKind) => void;
} {
	return {
		play: (kind) => {
			if (scene.sound.mute) {
				return;
			}
			if (!scene.cache.audio.exists(sfxKeys[kind])) {
				return;
			}
			scene.sound.play(sfxKeys[kind], { volume: 0.45 });
		},
	};
}
