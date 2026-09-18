import { expect, it } from 'vitest';
import { liveWsCount, presenceLit, PRESENCE_CACHE_MS } from './presence';
import src from '../../server/src/index.ts?raw';
import overlay from '../client/app/openingOverlay.ts?raw';
import html from '../../index.html?raw';

it('counts live WS in queue and rooms, pulses online button when someone is there', () => {
 expect(liveWsCount(1, 2)).toBe(3);
 expect(presenceLit(0)).toBe(false);
 expect(presenceLit(1)).toBe(true);
 expect(PRESENCE_CACHE_MS).toBe(10_000);
 expect(src).toContain('/stats/presence');
 expect(src).toContain('socks.size');
 expect(overlay).toContain('loadPresence');
 expect(overlay).toContain('opening-online');
 expect(html).toContain('opening-live-dot');
 expect(html).not.toContain('0 игроков');
 expect(html).toContain('opening-color-white');
});
