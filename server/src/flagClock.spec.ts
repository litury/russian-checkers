import { expect, it } from 'vitest';
import { FLAG_SLACK_MS, flagDue, flagWinner, turnLeft } from './flagClock.ts';
import src from './index.ts?raw';
import scene from '../../src/client/app/gameScene.ts?raw';
import live from '../../src/online/live.ts?raw';

it('flags when bank elapsed, with slack for client report', () => {
 expect(turnLeft(60_000, 0, 60_000)).toBe(0);
 expect(flagDue(60_000, 0, 60_000)).toBe(true);
 expect(flagDue(60_000, 0, 60_000 - FLAG_SLACK_MS)).toBe(true);
 expect(flagDue(60_000, 0, 0)).toBe(false);
 expect(flagWinner('white')).toBe('black');
});

it('server owns online flag; client freezes and waits for end', () => {
 expect(src).toContain("'flag', loserId");
 expect(src).toContain('flagDue');
 expect(live).toContain("type: 'flag'");
 expect(scene).toContain('live?.flag');
 expect(scene).toContain("reason === 'flag'");
});
