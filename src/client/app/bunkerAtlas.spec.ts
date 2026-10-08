import { describe, expect, it, vi } from 'vitest';
import { preloadBunkerPanels } from './bunkerPanel';
import bunkerAtlas from './ui/bunker/atlas.json';
import clockAtlas from './ui/clock-frame/atlas.json';

describe('clock and bunker lossless atlases', () => {
 it('queues exactly two image atlases and the unchanged steam sheet, with bundled metadata', () => {
  const atlas = vi.fn();
  const spritesheet = vi.fn();
  const image = vi.fn();
  preloadBunkerPanels({ load: { atlas, spritesheet, image } } as never);
  expect(atlas.mock.calls.map(c => c[0])).toEqual(['bunker-metal', 'clock-metal']);
  expect(atlas.mock.calls[0][2]).toBe(bunkerAtlas);
  expect(atlas.mock.calls[1][2]).toBe(clockAtlas);
  expect(image).not.toHaveBeenCalled();
  expect(spritesheet).toHaveBeenCalledExactlyOnceWith('bunker-steam', expect.any(String), { frameWidth: 72, frameHeight: 56 });
 });
 it('keeps all thirteen runtime bunker layers and three clock states at original dimensions, untrimmed', () => {
  expect(Object.keys(bunkerAtlas.frames).sort()).toEqual(['door-left', 'door-right', 'front-lip', 'lift-rails', 'lip-contact-shadow', 'panel-cast-shadow', 'panel-opponent-face', 'panel-own-face-prepared', 'panel-own-face-ready', 'readiness-light', 'rear-niche', 'side-vents', 'thick-frame']);
  expect(Object.keys(clockAtlas.frames).sort()).toEqual(['frame-c', 'frame-c-active', 'frame-c-lights']);
  for (const frame of Object.values(clockAtlas.frames)) expect(frame.sourceSize).toEqual({ w: 140, h: 79 });
  for (const group of [bunkerAtlas, clockAtlas]) for (const f of Object.values(group.frames)) {
   expect(f.rotated).toBe(false);
   expect(f.trimmed).toBe(false);
   expect(f.frame.w).toBe(f.sourceSize.w);
   expect(f.frame.h).toBe(f.sourceSize.h);
   expect(f.spriteSourceSize).toEqual({ x: 0, y: 0, ...f.sourceSize });
   expect(f.frame.x).toBeGreaterThanOrEqual(2);
   expect(f.frame.y).toBeGreaterThanOrEqual(2);
   expect(f.frame.x + f.frame.w).toBeLessThanOrEqual(group.meta.size.w - 2);
   expect(f.frame.y + f.frame.h).toBeLessThanOrEqual(group.meta.size.h - 2);
  }
 });
});
