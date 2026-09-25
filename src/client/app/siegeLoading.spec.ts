import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSiegeSide } from './siegeSelection';

// Minimal DOM ports exercise the real async renderer; no browser/Phaser dependency.
class Button extends EventTarget {
 dataset: Record<string, string>;
 attributes: Record<string, string>;
 classList = { toggle: vi.fn() };
 image = { hidden: false, src: '', classList: { add: vi.fn() } };
 context = { clearRect: vi.fn(), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), quadraticCurveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), clip: vi.fn() };
 canvas = { hidden: true, dataset: {} as Record<string, string>, getContext: () => this.context };
 constructor(side: string) {
  super(); this.dataset = { side }; this.attributes = { 'aria-pressed': String(side === 'white') };
 }
 setAttribute(name: string, value: string) { this.attributes[name] = value; }
 getAttribute(name: string) { return this.attributes[name]; }
 querySelector(selector: string) { return selector === 'canvas' ? this.canvas : this.image; }
}
class Root extends EventTarget {
 hidden = false; inert = false;
 buttons = [new Button('white'), new Button('black')];
 querySelectorAll() { return this.buttons; }
 querySelector() { return this.buttons[1]; }
}
const pending: { src: string; resolve: () => void; reject: () => void }[] = [];
let media: EventTarget & { matches: boolean };
beforeEach(() => {
 pending.length = 0;
 media = Object.assign(new EventTarget(), { matches: true });
 vi.stubGlobal('matchMedia', () => media);
 vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false, getElementById: () => null }));
 vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
 vi.stubGlobal('cancelAnimationFrame', vi.fn());
 vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });
 vi.stubGlobal('Image', class {
  src = '';
  decode() { return new Promise<void>((resolve, reject) => pending.push({ src: this.src, resolve, reject: () => reject(new Error('art unavailable')) })); }
 });
});
afterEach(() => vi.unstubAllGlobals());
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('Siege delayed/failed decoration', () => {
 it('reveals only after all three layers decode, using latest side after rapid reversal', async () => {
  const { mountSiegeOpening } = await import('./siegeOpening');
  const root = new Root();
  const dispose = mountSiegeOpening(root as unknown as HTMLElement);
  expect(pending.filter(load => /-(base|moving|front)\.webp/.test(load.src))).toHaveLength(6);
  expect(pending.filter(load => load.src.includes('menu-selection-fire'))).toHaveLength(1);
  pending[0].resolve(); pending[1].resolve();
  await flush();
  expect(root.buttons[0].canvas.hidden).toBe(true);
  setSiegeSide(root as unknown as HTMLElement, 'black');
  setSiegeSide(root as unknown as HTMLElement, 'white');
  setSiegeSide(root as unknown as HTMLElement, 'black');
  for (const load of pending) load.resolve();
  await flush();
  expect(root.buttons.map(button => button.canvas.hidden)).toEqual([false, false]);
  expect(root.buttons.map(button => button.canvas.dataset.displacement)).toEqual(['0', '55']);
  for (const button of root.buttons) {
   expect(button.context.translate).toHaveBeenCalledWith(64, 256);
   expect(button.context.clearRect).toHaveBeenCalledWith(0, 0, 852, 980);
   expect(button.context.save.mock.calls.length).toBe(button.context.restore.mock.calls.length);
  }
  expect(root.buttons[1].context.drawImage.mock.calls[1].slice(1)).toEqual([141, 105]);
  dispose();
 });
 it('keeps semantic selection and static fallback on art failure', async () => {
  const { mountSiegeOpening } = await import('./siegeOpening');
  const root = new Root();
  const dispose = mountSiegeOpening(root as unknown as HTMLElement);
  pending[0].reject();
  for (const load of pending.slice(1)) load.resolve();
  await flush();
  expect(root.buttons[0].dataset.art).toBe('static');
  expect(root.buttons[0].image.hidden).toBe(false);
  expect(root.buttons[0].getAttribute('aria-pressed')).toBe('true');
  expect(root.buttons[1].canvas.hidden).toBe(false);
  dispose();
 });
 it('does not reveal stale artwork after disposal', async () => {
  const { mountSiegeOpening } = await import('./siegeOpening');
  const root = new Root();
  const dispose = mountSiegeOpening(root as unknown as HTMLElement);
  dispose();
  for (const load of pending) load.resolve();
  await flush();
  expect(root.buttons.map(button => button.canvas.hidden)).toEqual([true, true]);
 });
});

it('depresses only the moving disk, preserving fixed base and rim, and returns on cancel', async () => {
 const {mountSiegeOpening} = await import('./siegeOpening');
 const root = new Root(); const dispose = mountSiegeOpening(root as unknown as HTMLElement);
 for (const load of pending) load.resolve(); await flush();
 const black=root.buttons[1]; black.context.drawImage.mockClear();
 root.dispatchEvent(new CustomEvent('menu-touch',{detail:{side:'black',held:true}}));
 expect(black.getAttribute('aria-pressed')).toBe('false');
 expect(black.canvas.dataset.touchOffset).toBe('34');
 expect(black.context.drawImage.mock.calls.map(call=>call.slice(1))).toEqual([[0,0],[141,194],[0,0]]);
 black.context.drawImage.mockClear();
 root.dispatchEvent(new CustomEvent('menu-touch',{detail:{side:'black',held:false}}));
 expect(black.context.drawImage.mock.calls.map(call=>call.slice(1))).toEqual([[0,0],[141,160],[0,0]]);
 expect(black.getAttribute('aria-pressed')).toBe('false');
 dispose();
});

it('animates bounded fire while selected, stops in background and reduced motion, disposes', async () => {
 media.matches = false;
 const callbacks = new Map<number, FrameRequestCallback>(); let serial = 0;
 vi.stubGlobal('requestAnimationFrame', vi.fn((fn: FrameRequestCallback) => {callbacks.set(++serial, fn); return serial;}));
 vi.stubGlobal('cancelAnimationFrame', vi.fn((id:number) => callbacks.delete(id)));
 const step = (time:number) => { const next = [...callbacks.values()]; callbacks.clear(); next.forEach(fn => fn(time)); };
 const {mountSiegeOpening} = await import('./siegeOpening');
 const root = new Root(); const dispose = mountSiegeOpening(root as unknown as HTMLElement);
 for(const load of pending) load.resolve(); await flush();
 step(100); step(220);
 expect(root.buttons[0].context.drawImage.mock.calls.some(call => call.length === 9)).toBe(true);
 expect(root.buttons[1].context.drawImage.mock.calls.some(call => call.length === 9)).toBe(false);
 expect(callbacks.size).toBe(1);
 root.buttons.forEach(button => button.context.drawImage.mockClear());
 setSiegeSide(root as unknown as HTMLElement, 'black'); step(250);
 const stamps = root.buttons[1].context.drawImage.mock.calls.filter(call => call.length === 9);
 expect(stamps.length).toBeGreaterThan(0);
 expect((stamps[0][0] as unknown as {src:string}).src).toContain('menu-selection-fire.webp');
 expect(root.buttons[0].context.drawImage.mock.calls.some(call => call.length === 9)).toBe(false);
 Object.defineProperty(document,'hidden',{value:true,configurable:true});
 document.dispatchEvent(new Event('visibilitychange'));
 expect(callbacks.size).toBe(0);
 Object.defineProperty(document,'hidden',{value:false,configurable:true});
 document.dispatchEvent(new Event('visibilitychange')); step(300);
 media.matches = true; media.dispatchEvent(new Event('change')); step(400);
 expect(callbacks.size).toBe(0);
 dispose(); expect(callbacks.size).toBe(0);
});
