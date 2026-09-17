import type { IYandexSdk } from './IYandexSdk';

declare global {
	interface Window {
		YaGames?: {
			init: () => Promise<{
				features?: { LoadingAPI?: { ready?: () => void } };
				adv?: {
					showFullscreenAdv?: (args: {
						callbacks?: {
							onOpen?: () => void;
							onClose?: (wasShown: boolean) => void;
							onError?: () => void;
						};
					}) => void;
				};
				on?: (event: string, callback: () => void) => void;
			}>;
		};
	}
}

export async function createYandexSdk(): Promise<IYandexSdk> {
	const api = window.YaGames;
	if (!api?.init) {
		return createStub();
	}
	try {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const raw = await Promise.race([
			api.init(),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error('SDK init timeout')), 2500);
			}),
		]).finally(() => clearTimeout(timer));
		const pauseListeners: Array<() => void> = [];
		const resumeListeners: Array<() => void> = [];
		let paused = false;
		raw.on?.('game_api_pause', () => {
			paused = true;
			for (const callback of pauseListeners) {
				callback();
			}
		});
		raw.on?.('game_api_resume', () => {
			paused = false;
			for (const callback of resumeListeners) {
				callback();
			}
		});
		return {
			isStub: false,
			ready: () => {
				raw.features?.LoadingAPI?.ready?.();
			},
			showFullscreenAdv: (handlers) => {
				if (!raw.adv?.showFullscreenAdv) {
					handlers.onClose?.(false);
					return;
				}
				raw.adv.showFullscreenAdv({ callbacks: handlers });
			},
			onPause: (callback) => {
				pauseListeners.push(callback);
				if (paused) {
					callback();
				}
			},
			onResume: (callback) => {
				resumeListeners.push(callback);
			},
		};
	} catch {
		return createStub();
	}
}

/** Let the local game start while the optional platform script initializes. */
export function deferYandexSdk(pending: Promise<IYandexSdk>): IYandexSdk {
	let current = createStub();
	let readyRequested = false;
	const pauses: Array<() => void> = [];
	const resumes: Array<() => void> = [];
	void pending.then(sdk => {
		current = sdk;
		for (const listener of pauses) sdk.onPause(listener);
		for (const listener of resumes) sdk.onResume(listener);
		pauses.length = resumes.length = 0;
		if (readyRequested) sdk.ready();
	}).catch(() => undefined);
	return {
		get isStub() { return current.isStub; },
		ready: () => { readyRequested = true; current.ready(); },
		showFullscreenAdv: handlers => current.showFullscreenAdv(handlers),
		onPause: callback => { if (current.isStub) pauses.push(callback); else current.onPause(callback); },
		onResume: callback => { if (current.isStub) resumes.push(callback); else current.onResume(callback); },
	};
}

export function loadPlatformScript(): Promise<void> {
	if (window.YaGames?.init) return Promise.resolve();
	const host = typeof location === 'undefined' ? '' : location.hostname;
	if (!/(^|\.)yandex\.(net|ru|com)$/i.test(host) && !/(^|\.)ya\.ru$/i.test(host)) {
		return Promise.resolve();
	}
	return new Promise(resolve => {
		const script = document.createElement('script');
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			script.onload = script.onerror = null;
			resolve();
		};
		const timer = setTimeout(finish, 2500);
		script.async = true;
		script.src = 'https://yandex.ru/games/sdk/v2';
		script.onload = script.onerror = finish;
		document.head.append(script);
	});
}

function createStub(): IYandexSdk {
	return {
		isStub: true,
		ready: () => undefined,
		showFullscreenAdv: (handlers) => {
			handlers.onClose?.(false);
		},
		onPause: () => undefined,
		onResume: () => undefined,
	};
}
