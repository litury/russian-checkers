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
	flight: 0.2,
	land: 0.5,
	capture: 0.38,
} as const;

export const sfxFadeMs = {
	in: 100,
	out: 150,
} as const;

export type HopSfxUrls = {
	select: string;
	hover: string;
	ignite: string;
	flight: string;
	land: string;
	capture: string;
};

type VolSound = Phaser.Sound.BaseSound & {
	volume: number;
	setVolume: (value: number) => unknown;
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

function equalPower(t: number, from: number, to: number): number {
	const w =
		to >= from ? Math.sin((t * Math.PI) / 2) : 1 - Math.cos((t * Math.PI) / 2);
	return from + (to - from) * w;
}

export function createTableSfx(scene: Phaser.Scene): {
	selectThenHover: () => void;
	stopHover: () => void;
	takeoff: () => void;
	land: (took: boolean) => void;
} {
	let hover: VolSound | undefined;
	let flight: VolSound | undefined;
	let hoverFade: Phaser.Tweens.Tween | undefined;
	let flightFade: Phaser.Tweens.Tween | undefined;

	function drop(sound: Phaser.Sound.BaseSound | undefined): void {
		sound?.stop();
		sound?.destroy();
	}

	function fadeVolume(
		sound: VolSound,
		to: number,
		duration: number,
		onComplete?: () => void,
	): Phaser.Tweens.Tween {
		const from = sound.volume;
		const state = { t: 0 };
		return scene.tweens.add({
			targets: state,
			t: 1,
			duration,
			ease: 'Linear',
			onUpdate: () => {
				sound.setVolume(equalPower(state.t, from, to));
			},
			onComplete: () => {
				sound.setVolume(to);
				onComplete?.();
			},
		});
	}

	function fadeOut(
		sound: VolSound | undefined,
		tween: Phaser.Tweens.Tween | undefined,
		duration: number,
	): void {
		tween?.stop();
		if (!sound) {
			return;
		}
		fadeVolume(sound, 0, duration, () => {
			drop(sound);
		});
	}

	function fadeOutHover(duration: number): void {
		const current = hover;
		const tween = hoverFade;
		hover = undefined;
		hoverFade = undefined;
		fadeOut(current, tween, duration);
	}

	function fadeOutFlight(): void {
		const current = flight;
		const tween = flightFade;
		flight = undefined;
		flightFade = undefined;
		fadeOut(current, tween, sfxFadeMs.out);
	}

	function stopHover(): void {
		fadeOutHover(sfxFadeMs.out);
	}

	return {
		selectThenHover: () => {
			playOne(scene, sfxKeys.select, sfxGain.select);
			fadeOutHover(sfxFadeMs.out);
			if (scene.sound.mute || !scene.cache.audio.exists(sfxKeys.hover)) {
				return;
			}
			const next = scene.sound.add(sfxKeys.hover, {
				loop: true,
				volume: 0,
			}) as VolSound;
			hover = next;
			next.play();
			hoverFade = fadeVolume(next, sfxGain.hover, sfxFadeMs.in);
		},
		stopHover,
		takeoff: () => {
			fadeOutHover(sfxFadeMs.in);
			fadeOutFlight();
			playOne(scene, sfxKeys.ignite, sfxGain.ignite);
			if (scene.sound.mute || !scene.cache.audio.exists(sfxKeys.flight)) {
				return;
			}
			const next = scene.sound.add(sfxKeys.flight, {
				loop: false,
				volume: 0,
			}) as VolSound;
			flight = next;
			next.play();
			flightFade = fadeVolume(next, sfxGain.flight, sfxFadeMs.in);
		},
		land: (took) => {
			fadeOutFlight();
			playOne(scene, sfxKeys.land, sfxGain.land);
			if (took) {
				playOne(scene, sfxKeys.capture, sfxGain.capture);
			}
		},
	};
}
