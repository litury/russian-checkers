/** Search decoration only; never gates input, networking or engine startup. */
const assets = import.meta.glob<string>(
	[
		'./ui/siege/search-button-*.webp',
		'./ui/siege/search-header.webp',
		'./ui/siege/search-body.webp',
		'./ui/siege/search-count.webp',
	],
	{
		eager: true,
		query: '?url',
		import: 'default',
	},
);
export const searchArtUrls = Object.values(assets);
const retained: HTMLImageElement[] = [];
let started = false;
export function warmSearchArt(): void {
	if (started) return;
	started = true;
	void (async () => {
		for (const url of searchArtUrls) {
			const image = new Image();
			image.fetchPriority = 'low';
			image.decoding = 'async';
			image.src = url;
			try {
				await image.decode();
				retained.push(image);
			} catch {
				/* Decoration failure is nonfatal. */
			}
		}
		performance.mark(
			retained.length === searchArtUrls.length
				? 'damka:search-art-warm'
				: 'damka:search-art-incomplete',
		);
	})();
}
document
	.getElementById('opening-online')
	?.addEventListener('pointerdown', warmSearchArt, { once: true });
document
	.getElementById('opening-online')
	?.addEventListener('click', warmSearchArt, { once: true });
