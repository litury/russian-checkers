import { expect, it } from 'vitest';
import scene from '@/client/app/gameScene.ts?raw';
const frames = import.meta.glob('./selection-v2/frames/*/*.webp', { eager: true, query: '?url', import: 'default' });
const seals = import.meta.glob('./selection/markers/*.webp', { eager: true, query: '?url', import: 'default' });
it('delivers112 v2 WebP frames and preserves the separate king seal', () => {
 expect(Object.keys(frames)).toHaveLength(112);
 for (const side of ['white', 'black']) for (let i = 0; i <= 55; i++)
  expect(frames[`./selection-v2/frames/${side}/${side}-${String(i).padStart(2, '0')}.webp`]).toBeTruthy();
 expect(Object.keys(seals)).toHaveLength(1);
 expect(scene).toContain('../modules/board/selection-v2/frames/*/*.webp');
 expect(scene).toContain("this.load.image('selection_king-seal'");
});
