import { expect, it } from 'vitest';
import { drawMenuFire } from './menuSelectionFire';
import html from '../../../index.html?raw';

it('keeps tall rear tongues and independently advects flame regions instead of just crossfading a flat strip', () => {
 const draws: number[][] = [];
 const context = { save() {}, restore() {}, drawImage(_image: unknown, ...args: number[]) { draws.push(args); } } as unknown as CanvasRenderingContext2D;
 drawMenuFire(context, {} as HTMLImageElement, 420, 0, false);
 expect(draws.some(draw => draw[5] < -100 && draw[3] < 200)).toBe(true);
 expect(new Set(draws.map(draw => draw[5])).size).toBeGreaterThan(2);
});

it('keeps selection identity outside the future press visual and numbers outside both buttons', () => {
 const buttons = [...html.matchAll(/<button[^>]*class="gate-piece-slot[\s\S]*?<\/button>/g)].map(match => match[0]);
 expect(buttons).toHaveLength(2);
 for (const button of buttons) {
  expect(button).toContain('canvas width="852" height="980"');
  expect(button).toContain('gate-piece-visual');
  expect(button).toContain('✓ ВЫБРАНО');
  expect(button).not.toContain('opening-win-count');
 }
 expect(html).toContain('ПОБЕДЫ ВСЕХ ИГРОКОВ · ОНЛАЙН');
 expect(html).toContain('Статистика недоступна');
});
