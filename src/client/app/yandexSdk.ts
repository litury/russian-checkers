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
		const raw = await api.init();
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
				raw.on?.('game_api_pause', callback);
			},
			onResume: (callback) => {
				raw.on?.('game_api_resume', callback);
			},
		};
	} catch {
		return createStub();
	}
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
