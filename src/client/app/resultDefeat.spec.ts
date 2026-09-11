import { expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
vi.mock('phaser', () => ({ default: { Textures: { FilterMode: { NEAREST: 0 } } } }));
import { createResultOverlay, loseHolds, winKeys } from './resultOverlay';

function setup() {
 const images: any[] = [];
 const timers: any[] = [];
 const make = (key = ''): any => {
  const state: any = { key, visible: false };
  const obj: any = new Proxy(state, { get(target, prop) {
   if (prop in target) return target[prop];
   return (...args: any[]) => {
    if (prop === 'setTexture') target.key = args[0];
    if (prop === 'setVisible') target.visible = args[0];
    return obj;
   };
  }});
  return obj;
 };
 const schedule = (delay: number, callback: () => void) => {
  const t = { delay, callback, removed: false, remove() { this.removed = true; } };
  timers.push(t); return t;
 };
 const scene = {
  textures: { exists: () => true, get: () => make() },
  add: { image: (_x: number, _y: number, key: string) => { const o = make(key); images.push(o); return o; }, rectangle: make, container: make, text: make },
  scale: { width: 390, height: 844 },
  time: { delayedCall: schedule, addEvent: (c: any) => schedule(c.delay, c.callback) },
  tweens: { add: make },
 } as unknown as Phaser.Scene;
 const overlay = createResultOverlay(scene, { onMenu: vi.fn(), onPlayAgain: vi.fn() });
 return { overlay, timers, hero: images[2] };
}

it.each(['white', 'black'] as const)('plays %s human defeat once, holds 08, and restarts at 00', human => {
 const { overlay, timers, hero } = setup();
 overlay.show(human === 'white' ? 'black' : 'white', human);
 expect(hero.key).toBe(`checkerDefeat_${human}_00`);
 for (let i = 0; i < 8; i++) {
  const timer = timers.shift();
  expect(timer.delay).toBe(loseHolds[i]);
  timer.callback();
  expect(hero.key).toBe(`checkerDefeat_${human}_0${i + 1}`);
 }
 expect(timers).toHaveLength(0);
 expect(hero.key).toBe(`checkerDefeat_${human}_08`);
 overlay.hide(); overlay.show(human === 'white' ? 'black' : 'white', human);
 expect(hero.key).toBe(`checkerDefeat_${human}_00`);
 const pending = timers[0]; overlay.hide(); expect(pending.removed).toBe(true);
 overlay.show(human, human); expect(hero.key).toBe(winKeys[0]);
});
