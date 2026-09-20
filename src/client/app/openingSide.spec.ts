import { expect, it } from 'vitest';
import html from '../../../index.html?raw';
import overlay from './openingOverlay.ts?raw';
import selection from './siegeSelection.ts?raw';
import scene from './gameScene.ts?raw';

it('picks a side on the existing gate disks, with accessible selection and current side retained', () => {
 expect(html).toContain('gate-piece-ivory is-chosen');
 expect(html).toContain('gate-piece-black');
 expect(html).not.toMatch(/alert\(/);
 expect(overlay).toContain("paintSide(siegeSide(root))");
 expect(overlay).toContain("pick('black')");
 expect(overlay).toContain('humanSide:()=>siegeSide(root)');
 expect(scene).toContain('this.title.humanSide()');
 expect(scene).toContain("this.humanSide === 'black'");
 expect(scene).toContain("this.online ? 'Соперник' : 'Бот'");
 expect(scene).toContain('youWin');
 expect(selection).toContain("classList.toggle('is-chosen'");
 expect(selection).toContain("setAttribute('aria-pressed'");
});
