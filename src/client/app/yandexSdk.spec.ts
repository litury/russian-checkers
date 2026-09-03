import { afterEach, describe, expect, it, vi } from 'vitest';
import { createYandexSdk } from './yandexSdk';

describe('createYandexSdk', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('stubs when YaGames is missing and skips ads', async () => {
		vi.stubGlobal('window', {});
		const sdk = await createYandexSdk();
		expect(sdk.isStub).toBe(true);
		const onClose = vi.fn();
		const onError = vi.fn();
		sdk.showFullscreenAdv({ onClose, onError });
		expect(onClose).toHaveBeenCalledWith(false);
		expect(onError).not.toHaveBeenCalled();
		expect(() => sdk.ready()).not.toThrow();
		const pause = vi.fn();
		sdk.onPause(pause);
		expect(pause).not.toHaveBeenCalled();
	});

	it('falls back to stub when init throws', async () => {
		vi.stubGlobal('window', {
			YaGames: {
				init: async () => {
					throw new Error('sdk init failed');
				},
			},
		});
		const sdk = await createYandexSdk();
		expect(sdk.isStub).toBe(true);
	});

	it('calls LoadingAPI.ready and forwards fullscreen callbacks', async () => {
		const ready = vi.fn();
		const showFullscreenAdv = vi.fn(
			(args: { callbacks?: { onClose?: (wasShown: boolean) => void } }) => {
				args.callbacks?.onClose?.(true);
			},
		);
		vi.stubGlobal('window', {
			YaGames: {
				init: async () => ({
					features: { LoadingAPI: { ready } },
					adv: { showFullscreenAdv },
					on: () => undefined,
				}),
			},
		});
		const sdk = await createYandexSdk();
		expect(sdk.isStub).toBe(false);
		sdk.ready();
		expect(ready).toHaveBeenCalledTimes(1);
		const onClose = vi.fn();
		sdk.showFullscreenAdv({ onClose });
		expect(showFullscreenAdv).toHaveBeenCalledWith({
			callbacks: expect.objectContaining({ onClose }),
		});
		expect(onClose).toHaveBeenCalledWith(true);
	});

	it('closes ads without calling them when the adv API is missing', async () => {
		vi.stubGlobal('window', {
			YaGames: {
				init: async () => ({
					features: { LoadingAPI: { ready: vi.fn() } },
					adv: {},
					on: () => undefined,
				}),
			},
		});
		const sdk = await createYandexSdk();
		expect(sdk.isStub).toBe(false);
		const onClose = vi.fn();
		sdk.showFullscreenAdv({ onClose });
		expect(onClose).toHaveBeenCalledWith(false);
	});

	it('replays pause if the platform paused before subscribe', async () => {
		const platform: { fire?: (event: string) => void } = {};
		vi.stubGlobal('window', {
			YaGames: {
				init: async () => ({
					on: (event: string, callback: () => void) => {
						const prev = platform.fire;
						platform.fire = (name: string) => {
							prev?.(name);
							if (name === event) {
								callback();
							}
						};
					},
				}),
			},
		});
		const sdk = await createYandexSdk();
		platform.fire?.('game_api_pause');
		const pause = vi.fn();
		sdk.onPause(pause);
		expect(pause).toHaveBeenCalledTimes(1);
	});
});
