import { expect, it } from 'vitest';
import { matchLayout } from '@/client/config/matchLayout';
import { verdictControlsGeometry } from './verdictControlsGeometry';

const safe = { top: 0, bottom: 0, left: 0, right: 0 };
it.each([[320, 844], [390, 844], [1280, 900], [1920, 1080]])(
	'keeps fixed-size targets inside the measured pocket at %s × %s',
	(width, height) => {
		const l = matchLayout(width, height, safe);
		const g = verdictControlsGeometry(width, height, safe);
		expect(g.left).toBe(l.you.x + 20 * l.panelScale);
		// 72 px longest primary label, at least 8 px breathing room each side.
		expect(g.primaryWidth).toBeGreaterThanOrEqual(88);
		expect(g.left + g.primaryWidth + 8 + 64).toBeLessThanOrEqual(l.you.x + 223 * l.panelScale);
		expect(g.top + 44).toBe(l.you.y + 89 * l.panelScale - 4);
		expect(g.top).toBeGreaterThanOrEqual(l.you.y + 27 * l.panelScale);
	},
);
it('tracks safe-area translation without changing target size or the board', () => {
	const a = verdictControlsGeometry(390, 844, safe);
	const b = verdictControlsGeometry(410, 864, { ...safe, left: 20, top: 20 });
	expect(b.primaryWidth).toBe(a.primaryWidth);
	expect(b.left).toBe(a.left + 20);
	expect(b.top).toBe(a.top + 20);
});
