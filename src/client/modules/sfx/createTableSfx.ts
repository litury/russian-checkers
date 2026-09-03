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

export const sfxMaster = 0.4; // linear control 0..1, default

export const sfxStorageKeys = {
	master: 'checkers.sfxMaster',
	muted: 'checkers.sfxMuted',
} as const;

export const musicGain = {
	meadow: 0.32,
	duck: 0.1,
	firstCapture: 0.8,
} as const;

/** Log taper: 0 → silence, 1 → unity. Slider feeds this, not a linear multiply. */
export function sfxMasterAmp(t = sfxMaster): number {
	const x = Math.min(1, Math.max(0, t));
	if (x <= 0) return 0;
	return (10 ** x - 1) / 9;
}

export function clampSfxMaster(t: number): number {
	if (!Number.isFinite(t)) {
		return sfxMaster;
	}
	return Math.min(1, Math.max(0, t));
}

export function parseSfxMaster(raw: string | null): number {
	if (raw == null || raw === '') {
		return sfxMaster;
	}
	return clampSfxMaster(Number(raw));
}

export function parseSfxMuted(raw: string | null): boolean {
	return raw === '1' || raw === 'true';
}

/** Scene volume from linear t. Mute uses amp(0); never multiply t on top of the log. */
export function outputVolume(linear: number, muted: boolean): number {
	return sfxMasterAmp(muted ? 0 : clampSfxMaster(linear));
}

export type HopSfxUrls = {
	select: string;
	hover: string;
	ignite: string;
	flight: string;
	land: string;
	capture: string;
};

export type TableMusicUrls = {
	meadow: string;
	firstCapture: string;
};

type VolSound = Phaser.Sound.BaseSound & {
	volume: number;
	setVolume: (value: number) => unknown;
};

type VolumeSound = { volume: number };

let boundScene: Phaser.Scene | undefined;
let sfxLinear = sfxMaster;
let sfxMutedFlag = false;
let musicUnlocked = false;
let applyMusicVol: () => void = () => undefined;

function readStorage(): Storage | undefined {
	try {
		return globalThis.localStorage;
	} catch {
		return undefined;
	}
}

function loadPrefs(): void {
	const store = readStorage();
	if (!store) {
		sfxLinear = sfxMaster;
		sfxMutedFlag = false;
		return;
	}
	sfxLinear = parseSfxMaster(store.getItem(sfxStorageKeys.master));
	sfxMutedFlag = parseSfxMuted(store.getItem(sfxStorageKeys.muted));
	if (sfxLinear <= 0) {
		sfxMutedFlag = true;
		sfxLinear = sfxMaster;
	}
}

function writePrefs(): void {
	const store = readStorage();
	if (!store) {
		return;
	}
	try {
		store.setItem(sfxStorageKeys.master, String(sfxLinear));
		store.setItem(sfxStorageKeys.muted, sfxMutedFlag ? '1' : '0');
	} catch {
		return;
	}
}

function applyAmp(): void {
	if (!boundScene) {
		return;
	}
	(boundScene.sound as VolumeSound).volume = outputVolume(
		sfxLinear,
		sfxMutedFlag,
	);
}

function unlockMusic(): void {
	musicUnlocked = true;
}

export function getSfxMaster(): number {
	return sfxMutedFlag ? 0 : sfxLinear;
}

export function getSfxMuted(): boolean {
	return sfxMutedFlag;
}

export function setSfxMaster(t: number): void {
	const next = clampSfxMaster(t);
	if (next <= 0) {
		sfxMutedFlag = true;
	} else {
		sfxLinear = next;
		sfxMutedFlag = false;
	}
	writePrefs();
	applyAmp();
	unlockMusic();
	applyMusicVol();
}

export function setSfxMuted(muted: boolean): void {
	if (muted) {
		sfxMutedFlag = true;
		if (sfxLinear <= 0) {
			sfxLinear = sfxMaster;
		}
	} else {
		sfxMutedFlag = false;
		if (sfxLinear <= 0) {
			sfxLinear = sfxMaster;
		}
	}
	writePrefs();
	applyAmp();
	unlockMusic();
	applyMusicVol();
}

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

function makeHtmlAudio(
	url: string,
	loop: boolean,
): HTMLAudioElement | undefined {
	try {
		if (typeof Audio === 'undefined') {
			return undefined;
		}
		const el = new Audio(url);
		el.loop = loop;
		el.preload = 'auto';
		return el;
	} catch {
		return undefined;
	}
}

export function createTableSfx(
	scene: Phaser.Scene,
	music?: TableMusicUrls,
): {
	selectThenHover: () => void;
	stopHover: () => void;
	takeoff: (took: boolean) => void;
	land: (took: boolean) => void;
	resetMatch: () => void;
	setPaused: (paused: boolean) => void;
} {
	boundScene = scene;
	musicUnlocked = false;
	loadPrefs();
	applyAmp();

	let hover: VolSound | undefined;
	let flight: VolSound | undefined;
	let hoverFade: Phaser.Tweens.Tween | undefined;
	let flightFade: Phaser.Tweens.Tween | undefined;
	let ducked = false;
	let paused = false;
	let firstCapturePlayed = false;
	const meadow = music?.meadow ? makeHtmlAudio(music.meadow, true) : undefined;
	const firstCapture = music?.firstCapture
		? makeHtmlAudio(music.firstCapture, false)
		: undefined;

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

	function applyMusic(): void {
		if (!meadow) {
			return;
		}
		const amp = sfxMasterAmp(getSfxMaster());
		meadow.volume = amp * (ducked ? musicGain.duck : musicGain.meadow);
		if (paused || amp <= 0) {
			meadow.pause();
			return;
		}
		if (!musicUnlocked) {
			return;
		}
		void meadow.play().catch(() => undefined);
	}

	applyMusicVol = applyMusic;
	applyMusic();

	const input = scene.input as
		| { once?: (event: string, fn: () => void) => void }
		| undefined;
	input?.once?.('pointerdown', () => {
		unlockMusic();
		applyMusic();
	});

	function playFirstCapture(): void {
		if (firstCapturePlayed || paused) {
			return;
		}
		firstCapturePlayed = true;
		if (getSfxMaster() <= 0) {
			return;
		}
		if (!firstCapture) {
			return;
		}
		try {
			firstCapture.currentTime = 0;
			firstCapture.volume =
				sfxMasterAmp(getSfxMaster()) * musicGain.firstCapture;
			void firstCapture.play().catch(() => undefined);
		} catch {
			return;
		}
	}

	return {
		selectThenHover: () => {
			unlockMusic();
			playOne(scene, sfxKeys.select, sfxGain.select);
			fadeOutHover(sfxFadeMs.out);
			applyMusic();
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
		takeoff: (took) => {
			unlockMusic();
			fadeOutHover(sfxFadeMs.in);
			fadeOutFlight();
			ducked = true;
			applyMusic();
			playOne(scene, sfxKeys.ignite, sfxGain.ignite);
			if (took) {
				playFirstCapture();
			}
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
			ducked = false;
			applyMusic();
		},
		resetMatch: () => {
			firstCapturePlayed = false;
			ducked = false;
			stopHover();
			if (firstCapture) {
				firstCapture.pause();
				try {
					firstCapture.currentTime = 0;
				} catch {
					// ignore
				}
			}
			applyMusic();
		},
		setPaused: (next) => {
			paused = next;
			if (next) {
				firstCapture?.pause();
			}
			applyMusic();
		},
	};
}
