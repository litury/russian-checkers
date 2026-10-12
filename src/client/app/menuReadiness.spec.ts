import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import html from '../../../index.html?raw';
const atlas = readFileSync(new URL('./ui/opening-atlas/atlas.css', import.meta.url), 'utf8');
import gates from './openingGates.css?raw';
import chronicle from './hangingChronicle.css?raw';
import renderer from './siegeOpening.ts?raw';
import manifest from './ui/opening-atlas/atlas.json';

it('keeps menu delivery compact and explicitly scoped, with offline metric-identical font sources', () => {
 const webp = readFileSync(new URL('./ui/opening-atlas/atlas.webp', import.meta.url));
 expect(webp.length).toBeLessThan(1_000_000);
 expect(webp.toString('ascii', 0, 4)).toBe('RIFF');
 expect(manifest.size[0]).toBeLessThanOrEqual(2048);
 expect(manifest.delivery).toEqual({format:'webp',quality:88,alpha:'lossless',scope:'menu-only',ownerApprovedLossy:true});
 expect(html.match(/data:font\/woff2;base64,/g)).toHaveLength(3);
 expect(html).toMatch(/font-family:Literata;src:url\('data:font\/woff2;base64,/);
 expect(html).toMatch(/font-family:'Golos Text';src:url\('data:font\/woff2;base64,/);
});

it('preloads exactly one owner-approved menu delivery atlas at high priority without JS visibility gates', () => {
 const preloads = [...html.matchAll(/<link[^>]+rel="preload"[^>]+as="image"[^>]*>/g)];
 expect(preloads).toHaveLength(1);
 expect(preloads[0][0]).toContain('/opening-atlas/atlas.webp');
 expect(preloads[0][0]).toContain('type="image/webp" fetchpriority="high"');
 for (const token of ['opening-menu-readiness', 'menu-settled', 'data-menu-state', 'titleFont', 'document.fonts', 'MENU_DEADLINE_MS']) expect(html).not.toContain(token);
 expect(html).toContain('font-display:swap');
 const menu = html.match(/<main id="opening"[\s\S]*?<\/main>/)![0];
 expect(menu).not.toMatch(/<img|<picture|loading="lazy"|srcset=/);
 expect(menu.match(/class="gate-piece atlas-slice"/g)).toHaveLength(2);
 expect(atlas).toContain("image-set(url('./atlas.webp') type('image/webp'), url('./atlas.avif') type('image/avif'))");
 expect(preloads[0][0]).toContain('crossorigin="anonymous"');
 expect(atlas).toContain('mask-mode:alpha');
 expect(atlas).toContain('opacity:1');
 expect(gates).not.toContain('is-gate-ready');
 expect(gates).not.toContain('opacity:0');
 expect(chronicle).not.toContain('linear-gradient(#141b20');
});

it('keeps all four CSS endpoints available synchronously while enhancement loads or fails', () => {
 for (const side of ['white','black']) for (const pressed of ['true','false']) {
  expect(atlas).toContain(`[data-side="${side}"][aria-pressed="${pressed}"] .gate-piece`);
 }
 expect(renderer).not.toMatch(/selection-v2\/frames|menu-settled|menuState|image\.src/);
 expect(renderer).toContain("querySelector<HTMLElement>('.gate-piece')!.hidden = true");
 expect(renderer).toContain("button.dataset.art = 'static'");
});
