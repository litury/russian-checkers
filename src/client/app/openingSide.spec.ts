import { expect, it } from 'vitest';
import html from '../../../index.html?raw';
import overlay from './openingOverlay.ts?raw';
import scene from './gameScene.ts?raw';

it('picks a side on the existing gate disks, white by default, no extra UI', () => {
 expect(html).toContain('gate-piece-ivory is-chosen');
 expect(html).toContain('gate-piece-black');
 expect(html).not.toMatch(/alert\(/);
 expect(overlay).toContain("paintSide('white')");
 expect(overlay).toContain("pick('black')");
 expect(overlay).toContain('humanSide:()=>side');
 expect(scene).toContain('this.title.humanSide()');
 expect(scene).toContain("this.humanSide === 'black'");
 expect(scene).toContain("this.online ? 'Соперник' : 'Бот'");
 expect(scene).toContain('youWin');
 expect(overlay).toContain("classList.toggle('is-chosen'");
});
