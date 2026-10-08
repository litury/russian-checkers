import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

describe('match action idle art warmup', () => {
	let frames: Array<() => void>;
	let idles: Array<() => void>;
	let pending: Array<{ resolve: () => void; reject: () => void }>;
	let images: Array<{ src: string; fetchPriority: string }>;
	let hide: () => void;
	let opening: { dataset: { menuState: string }; classList: { contains: () => boolean } };
	let play: { disabled: boolean };
	beforeEach(() => {
		vi.resetModules(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		frames = []; idles = []; pending = []; images = [];
		opening = { dataset: { menuState: 'ready' }, classList: { contains: () => false } };
		play = { disabled: false };
		vi.stubGlobal('document', { hidden: false, getElementById: (id: string) => id === 'opening' ? opening : play });
		vi.stubGlobal('window', { addEventListener: (_: string, fn: () => void) => { hide = fn; }, requestIdleCallback: (fn: () => void) => idles.push(fn) });
		vi.stubGlobal('requestAnimationFrame', (fn: () => void) => frames.push(fn));
		vi.stubGlobal('Image', class {
			src = ''; fetchPriority = ''; decoding = '';
			constructor() { images.push(this); }
			decode() { return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('offline')) })); }
		});
	});
	afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
	const painted = () => { frames.shift()?.(); frames.shift()?.(); idles.shift()?.(); };
	it('lists exactly the current fifteen PNG URLs, after two frames and idle; one flight, low priority, idempotent', async () => {
		const { warmMatchActionArt, matchActionArtUrls } = await import('./matchActionArtWarmup');
		expect(matchActionArtUrls).toHaveLength(15);
		expect(new Set(matchActionArtUrls).size).toBe(15);
		expect(matchActionArtUrls.map(url => url.split('/').pop()).sort()).toEqual([
			'dialog-copper.png', 'dialog-neutral.png', 'dialog.png',
			...['resign', 'undo'].flatMap(action => ['disabled', 'focus', 'hover', 'icon', 'pressed', 'rest'].map(state => `${action}-${state}.png`)),
		].sort());
		expect(matchActionArtUrls.every(url => url.endsWith('.png'))).toBe(true);
		warmMatchActionArt(); warmMatchActionArt();
		expect(images).toHaveLength(0); expect(frames).toHaveLength(1);
		painted(); expect(images).toHaveLength(1); expect(images[0].fetchPriority).toBe('low');
		await vi.advanceTimersByTimeAsync(5000); expect(images).toHaveLength(1);
		pending.shift()?.resolve(); await vi.advanceTimersByTimeAsync(0);
		expect(idles).toHaveLength(1); idles.shift()?.(); expect(images).toHaveLength(2);
	});
	it('waits while critical menu or transition is busy', async () => {
		const { warmMatchActionArt } = await import('./matchActionArtWarmup');
		play.disabled = true; warmMatchActionArt(); painted(); expect(images).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(500); play.disabled = false; idles.shift()?.(); expect(images).toHaveLength(1);
	});
	it('absorbs failures without retry and stops on pagehide', async () => {
		const { warmMatchActionArt } = await import('./matchActionArtWarmup'); warmMatchActionArt(); painted();
		pending.shift()?.reject(); await vi.advanceTimersByTimeAsync(0); idles.shift()?.(); expect(images).toHaveLength(2);
		hide(); pending.shift()?.resolve(); await vi.advanceTimersByTimeAsync(0); expect(idles).toHaveLength(0);
	});
	it('finishes all assets and continues after a hidden menu, even if its old Play button is disabled', async () => {
		vi.stubGlobal('document', { hidden: false, getElementById: (id: string) => id === 'opening' ? { ...opening, hidden: true } : { disabled: true } });
		const { warmMatchActionArt, matchActionArtUrls } = await import('./matchActionArtWarmup');
		warmMatchActionArt(); painted();
		for (const _url of matchActionArtUrls) {
			expect(pending).toHaveLength(1);
			pending.shift()?.resolve(); await vi.advanceTimersByTimeAsync(0); idles.shift()?.();
		}
		expect(images).toHaveLength(15);
		expect(performance.getEntriesByName('damka:match-action-art-warm').length).toBeGreaterThan(0);
	});
	it('uses a bounded yielding fallback without requestIdleCallback', async () => {
		vi.stubGlobal('window', { addEventListener: () => {} });
		const { warmMatchActionArt } = await import('./matchActionArtWarmup'); warmMatchActionArt(); painted();
		expect(images).toHaveLength(0); await vi.advanceTimersByTimeAsync(250); expect(images).toHaveLength(1);
	});
});
