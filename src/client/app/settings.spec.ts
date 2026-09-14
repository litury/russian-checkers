import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAutoMove, setAutoMove } from './settings';
import html from '../../../index.html?raw';
import hud from './createHud.ts?raw';

afterEach(() => {
	vi.unstubAllGlobals();
	setAutoMove(true);
});
describe('shared settings', () => {
	it('keeps settings on the opening only', () => {
		expect(hud).not.toMatch(/createSfxPanel|match-settings-entry|hudMenu/);
		expect(html).not.toContain('match-settings-entry');
		expect(html).not.toContain('Сдаться');
		expect(html).not.toMatch(/id="(?:opening-volume|opening-muted|settings-effects|settings-music)"/);
	});
	it('retains default sole-move automation and supports changing the preference', () => {
		expect(getAutoMove()).toBe(true);
		setAutoMove(false);
		expect(getAutoMove()).toBe(false);
	});
	it('provides labelled controls and the exact auto-move explanation before modules', () => {
		for (const label of [
			'Выполнять ход автоматически, если доступен только один вариант.',
		])
			expect(html).toContain(label);
		expect(html.indexOf('id="settings-auto"')).toBeLessThan(
			html.indexOf('type="module"'),
		);
	});
});
