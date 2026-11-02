const markNames = [
	'menu-presented',
	'engine-ready',
	'playfield-ready',
	'board-first-frame',
] as const;

export function startupDiagnostics() {
	const navigation = performance.getEntriesByType('navigation')[0] as
		| PerformanceNavigationTiming
		| undefined;
	const marks = Object.fromEntries(
		markNames.map((name) => {
			const entry = performance.getEntriesByName(`damka:${name}`, 'mark')[0];
			return [name, entry ? Math.round(entry.startTime) : null];
		}),
	);
	const criticalImages = [
		...document.querySelectorAll<HTMLLinkElement>(
			'link[rel="preload"][as="image"]',
		),
	]
		.slice(0, 3)
		.map((link, index) => {
			const entry = performance.getEntriesByName(link.href, 'resource')[0] as
				| PerformanceResourceTiming
				| undefined;
			return {
				slot: index,
				completed: Boolean(entry),
				durationMs: entry ? Math.round(entry.duration) : null,
				transferBytes: entry?.transferSize ?? null,
			};
		});
	return {
		elapsedMs: Math.round(performance.now()),
		menuReady: document.documentElement.dataset.menuPresentation === 'ready',
		menuFailed: document.documentElement.dataset.menuPresentation === 'error',
		engineReady: Boolean(window.checkersStartup?.engineLoaded),
		navigation: navigation
			? {
					ttfbMs: Math.round(
						navigation.responseStart - navigation.requestStart,
					),
					downloadMs: Math.round(
						navigation.responseEnd - navigation.responseStart,
					),
				}
			: null,
		marks,
		criticalImages,
	};
}
