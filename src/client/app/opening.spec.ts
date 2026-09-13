import html from '../../../index.html?raw';
import main from './main.ts?raw';
import scene from './gameScene.ts?raw';
import { describe, expect, it } from 'vitest';
describe('HTML-first opening', () => {
 it('wires real loader errors and uses the live HTML menu rather than a baked wordmark', () => {
  expect(scene).toContain('createOpeningOverlay');
  expect(scene).toContain("this.load.on('loaderror'");
  expect(scene).toContain('if (this.startupFailed) return;');
  expect(scene).not.toContain("this.load.image('titleWordmark'");
 });
 it('does not wait for fonts or the optional SDK before creating the game', () => {
  expect(main).not.toContain('await document.fonts.ready');
  expect(main).not.toContain('await createYandexSdk()');
 });
 it('uses a loading-only action label and pulse, without a duplicate kicker', () => {
  expect(html).toMatch(/id="opening-play"[^>]*disabled>Загрузка…<\/button>/);
  expect(html).toContain('#opening-play:disabled:not([hidden])');
  expect(html).not.toContain('opening-kicker');
 });
 it('provides live title, honest status and disabled Play before modules load', () => {
  expect(html).toContain('id="opening"');
  expect(html).toContain('Великие планы. Неизбежные жертвы.');
  expect(html).toMatch(/id="opening-play"[^>]*disabled/);
  expect(html).toContain('role="status"');
  expect(html.indexOf('id="opening"')).toBeLessThan(html.indexOf('type="module"'));
  expect(html).not.toContain('<script src="/sdk.js">');
 });
});
