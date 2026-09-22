import { expect, it } from 'vitest';
import html from '../../../index.html?raw';
import overlay from './openingOverlay.ts?raw';
it('CS-01 HTML stats start pending and have a lightweight entry before engine', () => {
 expect(html).toMatch(/id="opening-stats-unavailable"[^>]*>Загружаем статистику/);
 expect(html).toContain('src="/src/client/app/openingStats.ts"');
 expect(html).toContain('id="opening-stats-retry"');
 expect(overlay).not.toContain('void loadColorStats()');
});
