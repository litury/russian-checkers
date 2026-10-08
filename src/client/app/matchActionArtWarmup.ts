/** Best-effort DOM art cache, deliberately outside the game's readiness barrier. */
const assets = import.meta.glob<string>('./ui/match-actions/*.png', {
	eager: true,
	query: '?url',
	import: 'default',
}) as Record<string, string>;
export const matchActionArtUrls: string[] = Object.entries(assets)
	.sort(([a], [b]) => {
		const rank = (name: string) => name.includes('dialog') ? 1 : /rest|disabled|icon/.test(name) ? 0 : 2;
		return rank(a) - rank(b) || a.localeCompare(b);
	})
	.map(([, url]) => url);

let started = false;
// Retain decoded images for this document; browsers may still evict under pressure.
const retained: HTMLImageElement[] = [];

export function warmMatchActionArt(): void {
	if (started) return;
	started = true;
	let stopped = false;
	window.addEventListener('pagehide', () => { stopped = true; }, { once: true });
	const idle = (run: () => void) => {
		if (stopped) return;
		if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1500 });
		else setTimeout(run, 250);
	};
	const criticalBusy = () => {
		const opening = document.getElementById('opening');
		const play = document.getElementById('opening-play') as HTMLButtonElement | null;
		return document.hidden || (!opening?.hidden && (
			opening?.dataset.menuState === 'loading' || !!play?.disabled ||
			!!opening?.classList.contains('is-departing')));
	};
	let index = 0;
	const next = () => {
		if (stopped) return;
		if (index >= matchActionArtUrls.length) {
			performance.mark(retained.length === matchActionArtUrls.length
				? 'damka:match-action-art-warm' : 'damka:match-action-art-incomplete');
			return;
		}
		if (criticalBusy()) { setTimeout(() => idle(next), 500); return; }
		const image = new Image();
		image.fetchPriority = 'low';
		image.decoding = 'async';
		image.src = matchActionArtUrls[index++];
		// Single flight: idle CPU is not idle network. Do not launch sixteen fetches.
		// A failed request never blocks play, propagates rejection, or retries forever.
		void image.decode().then(() => { retained.push(image); }, () => {}).finally(() => idle(next));
	};
	requestAnimationFrame(() => requestAnimationFrame(() => idle(next)));
}
