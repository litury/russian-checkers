import { expect, it } from 'vitest';
import scene from '@/client/app/gameScene.ts?raw';
const frames = import.meta.glob('./selection-v2/frames/*/*.png', { eager: true, query: '?url', import: 'default' });
const seals = import.meta.glob('./selection/markers/*.png', { eager: true, query: '?url', import: 'default' });
it('delivers112 v2 PNG frames and preserves the separate king seal', () => {
 expect(Object.keys(frames)).toHaveLength(112);
 for (const side of ['white', 'black']) for (let i = 0; i <= 55; i++)
  expect(frames[`./selection-v2/frames/${side}/${side}-${String(i).padStart(2, '0')}.png`]).toBeTruthy();
 expect(Object.keys(seals)).toHaveLength(1);
 expect(scene).toContain('../modules/board/selection-v2/frames/*/*.png');
 expect(scene).toContain("this.load.image('selection_king-seal'");
});
