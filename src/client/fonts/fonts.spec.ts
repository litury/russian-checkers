import { describe, expect, it } from 'vitest';
import { hudFont, hudFontPx, titleFont, whenHudFontReady } from './fonts';

describe('self-hosted fonts', () => {
	it('uses Tiny5 for HUD and Russo One for the title, not Arial', () => {
		expect(hudFont).toBe('Tiny5');
		expect(titleFont).toBe('Russo One');
		expect(hudFont.includes('Arial')).toBe(false);
		expect(titleFont.includes('Arial')).toBe(false);
	});

	it('loads Tiny5 then runs the callback', async () => {
		let query = '';
		const previous = (globalThis as { document?: unknown }).document;
		(
			globalThis as {
				document: { fonts: { load: (q: string) => Promise<unknown> } };
			}
		).document = {
			fonts: {
				load: (q: string) => {
					query = q;
					return Promise.resolve([]);
				},
			},
		};
		try {
			let ran = false;
			whenHudFontReady(() => {
				ran = true;
			});
			await Promise.resolve();
			expect(query).toBe(`${hudFontPx}px ${hudFont}`);
			expect(ran).toBe(true);
		} finally {
			if (previous === undefined) {
				Reflect.deleteProperty(globalThis, 'document');
			} else {
				(globalThis as { document?: unknown }).document = previous;
			}
		}
	});
});
