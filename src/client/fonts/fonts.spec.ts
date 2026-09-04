import { describe, expect, it } from 'vitest';
import { hudFont, titleFont } from './fonts';

describe('self-hosted fonts', () => {
	it('uses Tiny5 for HUD and Russo One for the title, not Arial', () => {
		expect(hudFont).toBe('Tiny5');
		expect(titleFont).toBe('Russo One');
		expect(hudFont.includes('Arial')).toBe(false);
		expect(titleFont.includes('Arial')).toBe(false);
	});
});
