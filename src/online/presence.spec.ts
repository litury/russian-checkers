import { expect, it } from 'vitest';
import {
 countHeartbeats,
 dropHeartbeat,
 HEARTBEAT_TTL_MS,
 liveWsCount,
 presenceLit,
 touchHeartbeat,
} from './presence';
import src from '../../server/src/index.ts?raw';
import overlay from '../client/app/openingOverlay.ts?raw';
import html from '../../index.html?raw';
import cloud from './cloud.ts?raw';

it('counts unique visible tabs by heartbeat, drops immediately', () => {
 expect(HEARTBEAT_TTL_MS).toBe(18_000);
 expect(liveWsCount(1, 2)).toBe(3);
 expect(presenceLit(0)).toBe(false);
 expect(presenceLit(1)).toBe(true);
 const beats = new Map<string, number>();
 const t = 1_000_000;
 touchHeartbeat(beats, 'a:1', t);
 touchHeartbeat(beats, 'a:2', t);
 touchHeartbeat(beats, 'b:1', t);
 expect(countHeartbeats(beats, t)).toBe(3);
 dropHeartbeat(beats, 'a:2');
 expect(countHeartbeats(beats, t)).toBe(2);
 expect(countHeartbeats(beats, t + HEARTBEAT_TTL_MS + 1)).toBe(0);
 expect(src).toContain('touchHeartbeat');
 expect(src).toContain("method === 'POST'");
 expect(src).toContain('playerId}:${tab');
 expect(src).not.toContain('queue.length + seated');
 expect(cloud).toContain('beatPresence');
 expect(cloud).toContain('keepalive');
 expect(cloud).toContain('presenceTab');
 expect(overlay).toContain('beatPresence(false)');
 expect(overlay).toContain('pagehide');
 expect(overlay).toContain('document.hidden');
 expect(overlay).not.toContain('stopPresence();');
 expect(html).toMatch(/opening-live-count[^>]*hidden/);
 expect(html).not.toContain('0 игроков');
});
