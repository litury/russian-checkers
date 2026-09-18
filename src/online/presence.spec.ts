import { expect, it } from 'vitest';
import {
 countHeartbeats,
 dropHeartbeat,
 HEARTBEAT_TTL_MS,
 liveWsCount,
 presenceLit,
 PRESENCE_CACHE_MS,
 touchHeartbeat,
} from './presence';
import src from '../../server/src/index.ts?raw';
import overlay from '../client/app/openingOverlay.ts?raw';
import html from '../../index.html?raw';

it('counts unique heartbeats, not bot matches or hidden tabs', () => {
 expect(liveWsCount(1, 2)).toBe(3);
 expect(presenceLit(0)).toBe(false);
 expect(presenceLit(1)).toBe(true);
 expect(HEARTBEAT_TTL_MS).toBe(45_000);
 expect(PRESENCE_CACHE_MS).toBe(10_000);
 const beats = new Map<string, number>();
 const t = 1_000_000;
 touchHeartbeat(beats, 'a', t);
 touchHeartbeat(beats, 'b', t);
 expect(countHeartbeats(beats, t)).toBe(2);
 expect(countHeartbeats(beats, t + HEARTBEAT_TTL_MS + 1)).toBe(0);
 touchHeartbeat(beats, 'a', t);
 dropHeartbeat(beats, 'a');
 expect(countHeartbeats(beats, t)).toBe(0);
 expect(src).toContain('touchHeartbeat');
 expect(src).toContain("method === 'POST'");
 expect(src).toContain("const DROP_MS = 12_000");
 expect(overlay).toContain('beatPresence');
 expect(overlay).toContain('document.hidden');
 expect(overlay).toContain("beatPresence(false)");
 expect(html).toContain('С ботом');
 expect(html).toContain('С человеком');
 expect(html).toContain('opening-live-count');
 expect(html).toContain('opening-live-dot');
 expect(html).not.toContain('0 игроков');
 expect(overlay).toContain('opening-live-count');
});
