import type Phaser from 'phaser';

export const sfxKeys = {
	select: 'sfxSelect',
	hover: 'sfxHover',
	ignite: 'sfxIgnite',
	flight: 'sfxFlight',
	land: 'sfxLand',
	capture: 'sfxCapture',
} as const;

export const sfxGain = {
	select: 0.28,
	hover: 0.16,
	ignite: 0.58,
	flight: 0.4,
	land: 0.5,
	capture: 0.38,
} as const;

export type HopSfxUrls = {
	select: string;
	hover: string;
	ignite: string;
	flight: string;
	land: string;
	capture: string;
};

export function preloadTableSfx(scene: Phaser.Scene, urls: HopSfxUrls): void {
	const loader = scene.load as Phaser.Loader.LoaderPlugin & {
		audio: (key: string, url: string) => void;
	};
	loader.audio(sfxKeys.select, urls.select);
	loader.audio(sfxKeys.hover, urls.hover);
	loader.audio(sfxKeys.ignite, urls.ignite);
	loader.audio(sfxKeys.flight, urls.flight);
	loader.audio(sfxKeys.land, urls.land);
	loader.audio(sfxKeys.capture, urls.capture);
}

function playOne(scene: Phaser.Scene, key: string, volume: number): void {
	if (scene.sound.mute) {
		return;
	}
	if (!scene.cache.audio.exists(key)) {
		return;
	}
	scene.sound.play(key, { volume, loop: false });
}

export function createTableSfx(scene: Phaser.Scene): {
	selectThenHover: () => void;
	stopHover: () => void;
	takeoff: () => void;
	land: (took: boolean) => void;
} {
	let hover: Phaser.Sound.BaseSound | undefined;
	let flight: Phaser.Sound.BaseSound | undefined;

	function stop(sound: Phaser.Sound.BaseSound | undefined): void {
		sound?.stop();
		sound?.destroy();
	}

	function stopHover(): void {
		stop(hover);
		hover = undefined;
	}

	function stopFlight(): void {
		stop(flight);
		flight = undefined;
	}

	return {
		selectThenHover: () => {
			playOne(scene, sfxKeys.select, sfxGain.select);
			stopHover();
			if (scene.sound.mute || !scene.cache.audio.exists(sfxKeys.hover)) {
				return;
			}
			hover = scene.sound.add(sfxKeys.hover, {
				loop: true,
				volume: sfxGain.hover,
			});
			hover.play();
		},
		stopHover,
		takeoff: () => {
			stopHover();
			stopFlight();
			playOne(scene, sfxKeys.ignite, sfxGain.ignite);
			if (scene.sound.mute || !scene.cache.audio.exists(sfxKeys.flight)) {
				return;
			}
			flight = scene.sound.add(sfxKeys.flight, {
				loop: false,
				volume: sfxGain.flight,
			});
			flight.play();
		},
		land: (took) => {
			stopFlight();
			playOne(scene, sfxKeys.land, sfxGain.land);
			if (took) {
				playOne(scene, sfxKeys.capture, sfxGain.capture);
			}
		},
	};
}
