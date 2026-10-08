/** Decoration cache only: never a game readiness barrier. */
const assets = import.meta.glob<string>(
	[
		'./ui/match-actions/dialog*.webp',
		'./ui/match-actions/*-atlas.webp',
		'./ui/match-actions/*-icon.webp',
		'./ui/verdict/*.webp',
	],
	{
		eager: true,
		query: '?url',
		import: 'default',
	},
) as Record<string, string>;
export const matchActionArtUrls = Object.entries(assets)
	.sort(([a], [b]) => {
		const rank = (name: string) =>
			name.endsWith('/dialog.webp')
				? 0
				: name.endsWith('/resign-atlas.webp')
					? 0.5
					: name.includes('dialog')
						? 1
						: /hover|pressed|focus/.test(name)
							? 2
							: 3;
		return rank(a) - rank(b) || a.localeCompare(b);
	})
	.map(([, url]) => url);
const retained = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<boolean>>();
const feedbackWaiters: Array<(ready: boolean) => void> = [];
let started = false;
let stopped = false;
let index = 0;
let active = 0;
let completed = false;
function load(url: string): Promise<boolean> {
	const existing = pending.get(url);
	if (existing) return existing;
	const image = new Image();
	image.fetchPriority = 'low';
	image.decoding = 'async';
	image.src = url;
	const result = image
		.decode()
		.then(
			() => {
				retained.set(url, image);
				return true;
			},
			() => {
				// A failed decode must not poison an explicit retry for the rest of the page.
				pending.delete(url);
				return false;
			},
		)
		.then((ready) => {
			if (url === assets['./ui/match-actions/resign-atlas.webp'])
				feedbackWaiters.splice(0).forEach((resolve) => {
					resolve(ready);
				});
			return ready;
		});
	pending.set(url, result);
	return result;
}
function pump(): void {
	if (stopped || document.hidden) return;
	while (active < 2 && index < matchActionArtUrls.length) {
		const url = matchActionArtUrls[index++];
		active++;
		void load(url).finally(() => {
			active--;
			pump();
		});
	}
	if (!active && index === matchActionArtUrls.length && !completed) {
		completed = true;
		performance.mark(
			retained.size === matchActionArtUrls.length
				? 'damka:match-action-art-warm'
				: 'damka:match-action-art-incomplete',
		);
	}
}
/** Called after the first rendered board frame; two low-priority flights, no idle delay. */
export function warmMatchActionArt(): void {
	if (started) return;
	started = true;
	window.addEventListener('pagehide', () => {
		stopped = true;
	});
	window.addEventListener('pageshow', (event) => {
		if (event.persisted) {
			stopped = false;
			pump();
		}
	});
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) pump();
	});
	performance.mark('damka:match-action-art-start');
	pump();
	if ('requestIdleCallback' in window)
		window.requestIdleCallback(pump, { timeout: 1500 });
	else setTimeout(pump, 250);
}
// Диалог отдаётся как lossless WebP; PNG-мастера остаются в репозитории
// только как исходники и в рантайме не запрашиваются.
const dialogUrls = () =>
	matchActionArtUrls.filter((url) => /\/dialog[^/]*\.webp$/.test(url));
export function resignStatesReady(): boolean {
	return retained.has(assets['./ui/match-actions/resign-atlas.webp']);
}
export function resignArtReady(): boolean {
	return dialogUrls().every((url) => retained.has(url));
}
export function prepareResignFeedback(): Promise<boolean> {
	if (started) return load(assets['./ui/match-actions/resign-atlas.webp']);
	// Binding controls must not start decoration traffic ahead of the first board frame.
	return new Promise((resolve) => feedbackWaiters.push(resolve));
}
export function prepareResignArt(): Promise<boolean> {
	return Promise.all(dialogUrls().map(load)).then((results) =>
		results.every(Boolean),
	);
}
