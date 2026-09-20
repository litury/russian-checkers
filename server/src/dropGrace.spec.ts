import { expect, it } from 'vitest';
import src from './index.ts?raw';

it('presence routes exist and drop waits grace before endRoom', () => {
 expect(src).toContain("path === '/stats/presence'");
 expect(src).toContain("path === '/presence'");
 expect(src).toContain('const DROP_MS = 60_000');
 expect(src).not.toContain('const DROP_MS = 12_000');
 expect(src).toContain('room.drop.set');
 expect(src).toMatch(/dropPlayer[\s\S]*setTimeout\([\s\S]*endRoom[\s\S]*DROP_MS/);
 expect(src).toContain('if (pending) clearTimeout(pending)');
 expect(src).toMatch(/attach[\s\S]*if \(pending\) clearTimeout\(pending\)/);
 expect(src).toContain('clockFields');
 expect(src).toContain('...snap, ...clocks');
 expect(src).toMatch(/dropPlayer[\s\S]*flagTimer[\s\S]*DROP_MS/);
});
