const urls = [
	new URL('./ui/siege/panel-revision2/frame.webp', import.meta.url).href,
	new URL('../modules/board/reliquary/slate_tile.webp', import.meta.url).href,
	new URL('./ui/mobile-metal/plate.webp', import.meta.url).href,
	new URL('./ui/mobile-metal/center.webp', import.meta.url).href,
	new URL('./ui/siege/search-button-rest.webp', import.meta.url).href,
	new URL('./ui/siege/search-button-pressed.webp', import.meta.url).href,
];
let pending: Promise<boolean> | undefined;
let ready = false;
/** Decode only the hub's shared surfaces. A failure is retryable on the next opening. */
export function prepareOnlineHubArt(): Promise<boolean> {
	if (ready) return Promise.resolve(true);
	if (pending) return pending;
	pending = Promise.all(
		urls.map(
			(url) =>
				new Promise<boolean>((resolve) => {
					const image = new Image();
					const timer = window.setTimeout(() => resolve(false), 3000);
					image.onload = () => {
						void image.decode().then(
							() => finish(true),
							() => finish(false),
						);
					};
					image.onerror = () => finish(false);
					function finish(ok: boolean) {
						clearTimeout(timer);
						resolve(ok);
					}
					image.src = url;
				}),
		),
	)
		.then(async (loaded) => {
			if (loaded.every(Boolean)) {
				ready = await new Promise<boolean>((resolve) => {
					const timer = setTimeout(() => resolve(false), 1000);
					void Promise.all([
						document.fonts.load('600 26px Literata', 'Онлайн'),
						document.fonts.load(
							'500 16px "Golos Text"',
							'Найти Создать В меню',
						),
					]).then(
						() => {
							clearTimeout(timer);
							resolve(true);
						},
						() => {
							clearTimeout(timer);
							resolve(false);
						},
					);
				});
			}
			pending = undefined;
			return ready;
		})
		.catch(() => {
			pending = undefined;
			return false;
		});
	return pending;
}
export function warmOnlineHubArt(): () => void {
	let idle: number | undefined;
	const timer = window.setTimeout(() => {
		if ('requestIdleCallback' in window)
			idle = window.requestIdleCallback(
				() => {
					void prepareOnlineHubArt();
				},
				{ timeout: 1000 },
			);
		else void prepareOnlineHubArt();
	}, 500);
	return () => {
		window.clearTimeout(timer);
		if (idle !== undefined) window.cancelIdleCallback(idle);
	};
}
