import { expect, it } from 'vitest';
import scene from './gameScene.ts?raw';

it('online highlights follow applied turn, not HUD-only serverTurn', () => {
 expect(scene).toContain('clockTurn');
 expect(scene).toContain('turn: this.clockTurn()');
 expect(scene).toContain("this.phase === 'over'");
 expect(scene).toContain('canSelect()');
 expect(scene).toMatch(/this\.onlineHumanTurn\(\) \? 'human' : 'bot'/);
 expect(scene).toContain('this.drainInbound()');
 expect(scene).not.toMatch(
  /onlineBegun\s*\n\s*\t\t\t\t\? \(this\.serverTurn === this\.humanSide \? 'human' : 'bot'\)/,
 );
});
