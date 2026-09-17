import { expect, it } from 'vitest';
import overlay from './openingOverlay.ts?raw';
import html from '../../../index.html?raw';

it('places Play and online CTAs on the gate, not only in the DOM', () => {
	expect(html).toContain('id="opening-online"');
	expect(html).toContain('С человеком');
	expect(overlay).toContain('onPlayOnline');
  expect(overlay).toContain("getElementById('opening-online')");
  expect(overlay).not.toContain('gates.active||root.inert) return; handlers.onPlayOnline');
  expect(html).toContain('id="opening-search"');
  expect(html).toContain('Отмена');
});
