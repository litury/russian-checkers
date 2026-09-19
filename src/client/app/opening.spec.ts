import html from '../../../index.html?raw';
import main from './main.ts?raw';
import scene from './gameScene.ts?raw';
import overlay from './openingOverlay.ts?raw';
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
  expect(main).not.toContain('/sdk.js');
 });
 it('uses an accessible indeterminate loading indicator, without a duplicate kicker', () => {
  expect(html).toMatch(/id="opening-play"[^>]*aria-label="Загрузка игры"[^>]*aria-busy="true"[^>]*disabled>/);
  expect(html).toContain('class="opening-activity" aria-hidden="true"');
  expect(html).toContain('@keyframes opening-segment');
  expect(html).not.toContain('disabled>Загрузка…');
  expect(html).not.toContain('opening-kicker');
 });
 it('provides live title, honest status and disabled Play before modules load', () => {
  expect(html).toContain('id="opening"');
  expect(html).toContain('class="opening-slogan"');
  expect(html).toContain('id="opening-flavor-text"');
  expect(html).toContain("Пленных не будет...");
  expect(html).not.toContain('Великие планы. Неизбежные жертвы.');
  expect(html.indexOf('class="opening-slogan"')).toBeLessThan(html.indexOf('id="opening-status"'));
  expect(html).toMatch(/id="opening-status"[^>]*hidden/);
  expect(html).toMatch(/id="opening-play"[^>]*disabled/);
  expect(html).toContain('role="status"');
  expect(html.indexOf('id="opening"')).toBeLessThan(html.indexOf('type="module"'));
  expect(html).not.toContain('<script src="/sdk.js">');
  expect(html).toContain('data-api="%VITE_API_URL%"');
  expect(html).not.toContain('.replace(/%VITE_API_URL%');
  expect(html).toContain('id="opening-online"');
  expect(html).toContain('Онлайн');
 });
 it('unlocks Play from the HTML gate before Phaser preload packs', () => {
  expect(html).toContain('unlock()');
  expect(html).toContain('waitPlay()');
  expect(html).toContain('playIntent');
  expect(html).toContain('window.checkersStartup.unlock()');
  expect(html.indexOf('window.checkersStartup.unlock()')).toBeLessThan(html.indexOf("import('/src/client/app/main.ts')"));
  expect(overlay).toContain('playIntent');
  expect(overlay).toContain('pendingPlay');
  expect(scene).toContain('requestStartFromOpening');
  expect(scene).toContain('queueMatchInteractive');
  expect(scene).toContain('queueResultPack');
  expect(scene).toContain('queueTitleCritical');
  expect(scene).toContain('bootMatchInteractive');
  // Heavy packs are queued after create, not inside preload().
  const preload = scene.match(/preload\(\): void \{[\s\S]*?\n\t\}/)?.[0] ?? '';
  expect(preload).not.toContain('preloadKingFire');
  expect(preload).not.toContain('preloadBunkerPanels');
  expect(preload).not.toContain('selection-v2');
  expect(preload).not.toContain('defeatTerminal');
  expect(preload).not.toContain('checkerDefeat_');
  // playfieldReady = board+pieces+bunker only; selection/kingFire/result stay off that gate.
  const bootPlayfield = scene.match(/bootPlayfield\(\): Promise<void> \{[\s\S]*?\n\t\}/)?.[0] ?? '';
  expect(bootPlayfield).toContain('queueTitleCritical');
  expect(bootPlayfield).toContain('preloadBunkerPanels');
  expect(bootPlayfield).not.toContain('queueMatchInteractive');
  expect(bootPlayfield).not.toContain('queueResultPack');
  const bootInteractive = scene.match(/bootMatchInteractive\(\): Promise<void> \{[\s\S]*?\n\t\}/)?.[0] ?? '';
  expect(bootInteractive).toContain('await this.playfieldReady');
  expect(bootInteractive).toContain('queueMatchInteractive');
  expect(bootInteractive).not.toContain('preloadKingFire');
  expect(bootInteractive).not.toContain('queueKingFire');
  expect(bootInteractive).not.toContain('this.refresh()');
  expect(scene).toContain('bootKingFire');
  expect(scene).toContain('queueKingFire');
  const createBoot = scene.match(/create\(\): void \{[\s\S]*?\n\t\}/)?.[0] ?? '';
  expect(createBoot.indexOf('bootPlayfield')).toBeLessThan(createBoot.indexOf('bootMatchInteractive'));
  expect(createBoot.indexOf('bootMatchInteractive')).toBeLessThan(createBoot.indexOf('bootKingFire'));
  expect(createBoot.indexOf('bootKingFire')).toBeLessThan(createBoot.indexOf('bootResultPack'));
  expect(createBoot).toContain('await this.bootKingFire()');
  expect(createBoot).toContain('await this.bootResultPack()');
  // interactiveReady gates reveal (not HTML unlock); startMatch awaits before setPlayfieldVisible.
  const startMatch = scene.match(/private async startMatch\([\s\S]*?\n\t\}/)?.[0] ?? '';
  expect(startMatch).toContain('await this.interactiveReady');
  expect(startMatch.indexOf('await this.interactiveReady')).toBeLessThan(startMatch.indexOf('setPlayfieldVisible(true)'));
  expect(startMatch.indexOf('setPlayfieldVisible(true)')).toBeLessThan(startMatch.indexOf('beginCountdown'));
  expect(startMatch.indexOf('setPlayfieldVisible(true)')).toBeLessThan(startMatch.indexOf('this.refresh()'));
  expect(scene).toMatch(/await this\.interactiveReady;[\s\S]*await this\.startMatch\(true\)/);
 });

 it('one-tap play intent auto-starts without a second click', () => {
  // Early unlock stays; click queues intent and honest wait — never idle «Играть» again.
  expect(html).toContain('pendingPlay');
  expect(html).toContain('playCommitted');
  expect(html).toContain('playIntent');
  expect(html).toMatch(/pendingPlay \|\| window\.checkersStartup\.playCommitted/);
  expect(html).toContain("window.checkersStartup.playCommitted = true");
  expect(overlay).toContain('flushPendingPlay');
  expect(overlay).toContain('pendingPlay');
  expect(overlay).toContain('playCommitted');
  expect(overlay).toContain('waitPlay()');
  // show() treats playCommitted like pending — never clear committed then unlock
  expect(overlay).toMatch(/pendingPlay \|\| window\.checkersStartup\.playCommitted/);
  expect(overlay).not.toMatch(/playCommitted\s*=\s*false\s*;\s*window\.checkersStartup\.unlock/);
  // playfieldReady Deferred exists before overlay so await is never undefined
  expect(scene).toMatch(/playfieldReady:\s*Promise<void>\s*=\s*new Promise/);
  const create = scene.match(/create\(\): void \{[\s\S]*?\n\t\}/)?.[0] ?? '';
  expect(create.indexOf('bootPlayfield')).toBeGreaterThan(-1);
  expect(create.indexOf('bootPlayfield')).toBeLessThan(create.indexOf('createOpeningOverlay'));
  expect(create.indexOf('playfieldReady')).toBeLessThan(create.indexOf('createOpeningOverlay'));
  expect(create).toContain('flushPendingPlay');
  expect(create.indexOf('this.title.show()')).toBeLessThan(create.indexOf('flushPendingPlay'));
  expect(scene).toContain('requestStartFromOpening');
  expect(scene).toContain('waitPlay');
  expect(scene).toContain('playCommitted = false');
 });
});
