import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync(new URL('./onlineHub.css', import.meta.url), 'utf8');

it('keeps the return label safe inside fixed 22px artwork ends on phone and desktop', () => {
	const widths = [
		...css.matchAll(
			/#online-hub \.oh-header \.oh-button \{ min-width:(\d+)px;/g,
		),
	].map((match) => Number(match[1]));
	// Conservative rendered Golos bounds from the real 390/1280 DPR2/3 browser probe.
	expect(widths).toEqual([124, 116]);
	expect(widths[0] - 2 * 22 - 62).toBeGreaterThanOrEqual(2 * 8);
	expect(widths[1] - 2 * 22 - 55).toBeGreaterThanOrEqual(2 * 8);
});
