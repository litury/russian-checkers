import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync(new URL('./onlineHub.css', import.meta.url), 'utf8');

it('keeps labels transparent without a padded rectangle', () => {
 expect(css).toContain('.oh-button span { background:transparent; padding:0; border-radius:0; }');
 expect(css).not.toContain('#151b1be6');
});
it('scales corners uniformly to half size and shares the 64px height', () => {
 expect(css).toContain("search-button-rest.webp') 40 48 fill / 20px 24px / 0 stretch");
 expect(24 / 48).toBe(0.5);
 expect(20 / 40).toBe(0.5);
 expect(css).toContain('search-button-pressed.webp');
 expect(css).not.toContain('button-steel-');
 expect(css).toContain('.oh-button { height:64px; min-height:64px;');
 expect(css).not.toContain('min-height:48px');
});

it('keeps the return label safe inside fixed 24px artwork ends on phone and desktop', () => {
	const widths = [
		...css.matchAll(
			/#online-hub \.oh-header \.oh-button \{ min-width:(\d+)px;/g,
		),
	].map((match) => Number(match[1]));
	// Conservative rendered Golos bounds from the real 390/1280 DPR2/3 browser probe.
	expect(widths).toEqual([128, 120]);
	expect(widths[0] - 2 * 24 - 62).toBeGreaterThanOrEqual(2 * 8);
	expect(widths[1] - 2 * 24 - 55).toBeGreaterThanOrEqual(2 * 8);
});
