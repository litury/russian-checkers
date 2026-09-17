import { expect, it } from 'vitest';
import scene from './gameScene.ts?raw';

it('online local zero freezes input and does not endMatch itself', () => {
 expect(scene).toMatch(/if \(this\.online\) \{[^}]*flagLock = true/s);
 expect(scene).toContain('this.live?.flag()');
 expect(scene).not.toMatch(/private onFlag\(\): void \{\s*if \(this\.online\) return;/);
 expect(scene).toContain('this.flagLock');
});
