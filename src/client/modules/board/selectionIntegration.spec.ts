import { beforeEach, expect, it, vi } from 'vitest';
class EventEmitter {
 private listeners = new Map<string, ((...args: any[]) => void)[]>();
 on(name: string, fn: (...args: any[]) => void) { this.listeners.set(name, [...this.listeners.get(name) ?? [], fn]); }
 once(name: string, fn: (...args: any[]) => void) { this.on(name, fn); }
 off(name: string, fn: (...args: any[]) => void) { this.listeners.set(name, this.listeners.get(name)?.filter(f => f !== fn) ?? []); }
 emit(name: string, ...args: any[]) { this.listeners.get(name)?.forEach(fn => fn(...args)); }
}
vi.mock('@/client/config/reliquaryLayout', () => ({ reliquaryLayout: () => ({ originX: 0, originY: 0, cell: 44, scale: 1 }) }));
vi.mock('phaser', () => ({ default: { Textures: { FilterMode: { LINEAR: 1 } }, Geom: { Rectangle: class { static Contains() {} } } } }));
vi.mock('@/client/app/displayDensity', () => ({ logicalSize: () => ({ width: 1024, height: 768 }) }));
import { createBoardView } from './createReliquaryBoardView';
import sceneSource from '@/client/app/gameScene.ts?raw';
import type { IPosition } from '@/rules';

function harness(reduced = false, blocked: () => boolean = () => false) {
 vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
 vi.stubGlobal('document', { activeElement: null });
 const objects: any[] = [], tweens: any[] = [];
 const make = (x = 0, y = 0, texture = '') => {
  const state: any = { x, y, texture: { key: texture }, data: {}, visible: true, destroyed: false, children: [] };
  const obj: any = new Proxy(state, { get(t, prop) {
   if (prop in t) return t[prop];
   return (...args: any[]) => {
    if (prop === 'setTexture') t.texture = { key: args[0] };
    if (prop === 'setPosition') { t.x = args[0]; t.y = args[1]; }
    if (prop === 'setDisplaySize') { t.displayWidth = args[0]; t.displayHeight = args[1]; }
    if (prop === 'setOrigin') { t.originX = args[0]; t.originY = args[1]; }
    if (prop === 'setName') t.name = args[0];
    if (prop === 'setDepth') t.depth = args[0];
    if (prop === 'setFrame') t.frame = args[0];
    if (prop === 'setRotation') t.rotation = args[0];
    if (prop === 'setData') t.data[args[0]] = args[1];
    if (prop === 'setVisible') t.visible = args[0];
    if (prop === 'destroy') { t.destroyed = true; t.children.forEach((c: any) => c.destroy()); }
    return obj;
   };
  } }); objects.push(obj); return obj;
 };
 const events = new EventEmitter();
 const scene: any = {
  textures: { get: () => ({ setFilter() {} }) },
  add: { image: make, sprite: make, graphics: () => make(), tileSprite: make, rectangle: make,
   container: (x: number, y: number, children: any[]) => { const c = make(x,y); c.children = children; return c; } },
  game: { canvas: { getAttribute: () => null, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} } },
  tweens: { killTweensOf: vi.fn(), add: (t: any) => { tweens.push(t); return t; } }, events,
 };
 const board = createBoardView(scene, () => {}, () => {}, blocked);
 const tick = (ms: number) => events.emit('update', 0, ms);
 const finish = () => { const t = tweens.shift(); expect(t).toBeDefined(); t.onComplete(); };
 const sprite = () => objects.find(o => o.name === 'selection-piece' && !o.destroyed);
 return { board, tick, finish, sprite, objects, tweens, events };
}
const from = { row: 2, col: 0 }, land = { row: 3, col: 1 };
function position(kind: 'man' | 'king' = 'man', side: 'white' | 'black' = 'white', square = from): IPosition {
 const squares: IPosition['squares'] = Array.from({ length: 8 }, () => Array(8).fill(null));
 squares[square.row][square.col] = { kind, side };
 return { squares, turn: side };
}
beforeEach(() => vi.unstubAllGlobals());
const fire = (h: ReturnType<typeof harness>, mode: string) => h.objects.filter(o => !o.destroyed && o.visible && o.data.mode === mode && o.name.startsWith('king-fire-'));
it('loaded logical kings get idle only; men never get king fire', () => {
 const h = harness();
 h.board.sync(position(), [from], from); h.tick(1000);
 expect(fire(h, 'idle')).toHaveLength(0);
 h.board.sync(position('king'), [], null);
 expect(fire(h, 'idle')).toHaveLength(2);
 expect(fire(h, 'ignite')).toHaveLength(0);
});
it('promotion ignites immediately at mid-chain landing, then extinguishes on next takeoff', () => {
 const h = harness();
 const start = { row: 5, col: 1 }, crown = { row: 7, col: 3 }, end = { row: 4, col: 6 };
 h.board.sync(position('man', 'white', start), [start], start);
 let atCrown = 0;
 h.board.playMove({ from: start, path: [crown, end] }, () => {}, () => {
  if (h.sprite().data.square.row === 7) atCrown = fire(h, 'ignite').length;
 });
 expect(fire(h, 'ignite')).toHaveLength(0);
 h.finish();
 expect(atCrown).toBe(2);
 expect(fire(h, 'ignite')).toHaveLength(0);
 expect(fire(h, 'moving')).toHaveLength(1);
 expect(fire(h, 'idle')).toHaveLength(0);
 h.finish();
 expect(fire(h, 'idle')).toHaveLength(2);
 expect(fire(h, 'moving')).toHaveLength(0);
 h.tick(1200);
 expect(fire(h, 'ignite')).toHaveLength(0);
});
it.each(['reset', 'hide', 'shutdown', 'resize'] as const)('cleans king fire and ignores stale move updates on %s', action => {
 const h = harness(); h.board.sync(position('king'), [from], from);
 h.board.playMove({ from, path: [{ row: 7, col: 5 }] }, () => {});
 const tween = h.tweens[0]; tween.targets.x += 80; tween.onUpdate(tween, tween.targets, 'y');
 expect(fire(h, 'trail').length).toBeGreaterThan(0);
 if (action === 'reset') h.board.reset();
 if (action === 'hide') h.board.setPlayfieldVisible(false);
 if (action === 'shutdown') h.events.emit('shutdown');
 if (action === 'resize') h.board.layout(800, 600);
 tween.targets.x += 80; tween.onUpdate(tween, tween.targets, 'y');
 for (const mode of ['idle', 'ignite', 'moving', 'trail']) expect(fire(h, mode)).toHaveLength(0);
});
it('samples king trails by world distance, leaves source idle behind, and expires residue', () => {
 const h = harness(); h.board.sync(position('king'), [from], from);
 const old = fire(h, 'idle')[0];
 h.board.playMove({ from, path: [{ row: 7, col: 5 }] }, () => {});
 expect(fire(h, 'idle')).toHaveLength(0);
 const tween = h.tweens[0];
 tween.targets.x += 48; tween.onUpdate(tween, tween.targets, 'y');
 const drops = fire(h, 'trail'); expect(drops).toHaveLength(3);
 expect(drops.map(d => d.x)).toEqual([38, 54, 70]);
 expect(new Set(drops.map(d => d.y)).size).toBeGreaterThan(1);
 for (const drop of drops) expect(Math.abs(drop.y - 242)).toBeLessThanOrEqual(4.5);
 expect(old.x).toBe(22);
 tween.targets.x += 16; tween.onUpdate(tween, tween.targets, 'y');
 expect(drops[0].x).toBe(38);
 h.tick(2500); expect(fire(h, 'trail')).toHaveLength(0);
});
it('suppresses idle under ignition, resumes after1200ms, and removes captured owner bursts', () => {
 const h = harness(); const start = { row: 6, col: 0 }, crown = { row: 7, col: 1 };
 h.board.sync(position('man', 'white', start), [start], start);
 h.board.playMove({ from: start, path: [crown] }, () => {}); h.finish();
 expect(fire(h, 'idle')).toHaveLength(0); expect(fire(h, 'ignite')).toHaveLength(2);
 h.tick(1200); expect(fire(h, 'idle')).toHaveLength(2);
 h.board.reset(); h.board.sync(position('man', 'white', start), [start], start);
 h.board.playMove({ from: start, path: [crown] }, () => {}); h.finish();
 h.board.sync(position(), [], null);
 expect(fire(h, 'ignite')).toHaveLength(0);
});
it('live reduced motion switches to static heat and clears every transient', () => {
 const h = harness(); h.board.sync(position('king'), [from], from);
 vi.stubGlobal('matchMedia', () => ({ matches: true })); h.tick(100);
 expect(fire(h, 'idle')).toHaveLength(0); expect(fire(h, 'static')).toHaveLength(1);
 h.board.playMove({ from, path: [land] }, () => {});
 expect(fire(h, 'moving')).toHaveLength(0); expect(fire(h, 'trail')).toHaveLength(0);
 expect(fire(h, 'static')).toHaveLength(1);
});
it('loads the six baked64x80 sheets and layers all fire below hints', () => {
 expect(sceneSource).toContain('preloadKingFire(this)');
 const h = harness(); h.board.sync(position('king'), [from], from);
 const hint = h.objects.find(o => o.name === 'opening-move-hint');
 for (const sprite of fire(h, 'idle')) expect(sprite.depth).toBeLessThan(hint.depth);
});
it('clears fire for the menu and resumes only idle on return', () => {
 let blocked = false; const h = harness(false, () => blocked);
 h.board.sync(position('king'), [from], from);
 blocked = true; h.tick(1); expect(fire(h, 'idle')).toHaveLength(0);
 blocked = false; h.tick(1); expect(fire(h, 'idle')).toHaveLength(2);
 expect(fire(h, 'ignite')).toHaveLength(0);
});
it('bounds trail allocations to128 and keeps early flames upright before aligned soot', () => {
 const h = harness(); h.board.sync(position('king'), [from], from);
 h.board.playMove({ from, path: [land] }, () => {});
 const tween = h.tweens[0];
 for (let i = 0; i < 200; i++) { tween.targets.x += 16; tween.onUpdate(tween, tween.targets, 'y'); }
 expect(h.objects.filter(o => o.name === 'king-fire-trail' && !o.destroyed)).toHaveLength(128);
 expect(fire(h, 'trail')).toHaveLength(128);
 h.tick(900); expect(fire(h, 'trail')[0].rotation).toBe(0);
 h.tick(100); expect(fire(h, 'trail')[0].rotation).toBeCloseTo(Math.PI / 4);
 h.tick(1500); expect(fire(h, 'trail')).toHaveLength(0);
 tween.targets.x += 16; tween.onUpdate(tween, tween.targets, 'y');
 expect(h.objects.filter(o => o.name === 'king-fire-trail' && !o.destroyed)).toHaveLength(128);
});
it('widens trail across the path without changing along-path spacing',()=>{
 const h=harness();h.board.sync(position('king'),[from],from);h.board.playMove({from,path:[land]},()=>{});
 const t=h.tweens[0],y=t.targets.y;t.targets.x+=160;t.onUpdate(t,t.targets,'y');
 const drops=fire(h,'trail');const spread=Math.max(...drops.map(d=>Math.abs(d.y-y)*44/d.data.cell));
 expect(spread).toBeGreaterThan(3.5);expect(spread).toBeLessThanOrEqual(4.5);
});
it('samples only after both Phaser tween properties update, never an L-shaped trail', () => {
 const h = harness(); h.board.sync(position('king'), [from], from);
 h.board.playMove({ from, path: [land] }, () => {});
 const tween = h.tweens[0];
 tween.targets.x += 44; tween.onUpdate(tween, tween.targets, 'x');
 expect(fire(h, 'trail')).toHaveLength(0);
 tween.targets.y -= 44; tween.onUpdate(tween, tween.targets, 'y');
 expect(fire(h, 'trail')).toHaveLength(3);
 for (const drop of fire(h, 'trail')) expect(drop.data.angle).toBeCloseTo(-Math.PI / 4);
});
it('moves the sole selected group without closing at departure, then closes at the landing', () => {
 const h = harness();
 h.board.sync(position(), [from], from);
 h.tick(325);
 const piece = h.sprite(), progress = piece.data.progress;
 const order: string[] = [];
 h.board.playMove({ from, path: [land] }, () => {
  order.push('done'); h.board.sync(position('man', 'white', land), [], null);
 }, () => order.push('land'), () => order.push('takeoff'));
 expect(h.tweens[0].targets.name).toBe('selection-piece-group');
 h.tick(80);
 expect(piece.data.progress).toBe(progress);
 expect(h.objects.filter(o => o.name === 'selection-piece' && !o.destroyed)).toHaveLength(1);
 h.finish();
 expect(order).toEqual(['takeoff', 'land', 'done']);
 expect(h.sprite()).toBe(piece);
 expect(piece.data.square).toEqual(land);
 expect(piece.data.progress).toBe(progress);
 h.tick(650);
 expect(piece.texture.key).toBe('selection_white-00');
 // GameScene must not clear selection in a pre-departure sync (especially reduced motion).
 expect(sceneSource).not.toContain('this.board.sync(visual, [], null)');
 expect(sceneSource).not.toContain('this.board.sync(this.position, [], null)');
});
it('holds frame20 between capture hops and only assembles after the final hop', () => {
 const h = harness();
 h.board.sync(position(), [from], from);
 h.tick(100);
 h.board.playMove({ from, path: [land] }, () => h.board.sync(position('man', 'white', land), [land], land), undefined, undefined, true);
 h.finish();
 expect(h.sprite().texture.key).toBe('selection_white-55');
 h.tick(1);
 expect(h.sprite().texture.key).toBe('selection_white-55');
 h.tick(5000);
 expect(h.sprite().texture.key).toBe('selection_white-55');
 const end = { row: 4, col: 2 };
 h.board.playMove({ from: land, path: [end] }, () => h.board.sync(position('man', 'white', end), [], null), undefined, undefined, true);
 h.tick(80);
 expect(h.sprite().texture.key).toBe('selection_white-55');
 h.finish();
 h.tick(650);
 expect(h.sprite().texture.key).toBe('selection_white-00');
});
it.each(['white', 'black'] as const)('promotes %s using logical kind, with the original king and separate seal', side => {
 const h = harness();
 const start = { row: side === 'white' ? 6 : 1, col: 0 };
 const crown = { row: side === 'white' ? 7 : 0, col: 1 };
 h.board.sync(position('man', side, start), [start], start);
 h.tick(650);
 h.board.playMove({ from: start, path: [crown] }, () => {});
 h.finish();
 expect(h.sprite().data.kind).toBe('king');
 expect(h.sprite().texture.key).toBe(`selection_${side}-55`);
 expect(h.sprite().originX).toBeCloseTo(365 / 724);
 expect(h.objects.find(o => o.name === 'king-seal' && !o.destroyed).visible).toBe(true);
});
it.each(['reset', 'hide', 'shutdown'] as const)('%s invalidates a late move completion without touching a newly selected piece', action => {
 const h = harness();
 h.board.sync(position(), [from], from);
 h.tick(650);
 const stale = h.sprite(), done = vi.fn();
 h.board.playMove({ from, path: [land] }, done);
 if (action === 'reset') h.board.reset();
 if (action === 'hide') h.board.setPlayfieldVisible(false);
 if (action === 'shutdown') h.events.emit('shutdown');
 h.board.setPlayfieldVisible(true);
 h.board.sync(position(), [from], from);
 h.tick(650);
 h.finish();
 expect(done).not.toHaveBeenCalled();
 expect(stale.destroyed).toBe(true);
 expect(h.sprite()).not.toBe(stale);
 expect(h.sprite().texture.key).toBe(action === 'shutdown' ? 'selection_white-00' : 'selection_white-55');
});
it('end and resignation invalidate old board work before presenting the final position', () => {
 for (const method of ['private endMatch(', 'resignMatch(']) {
  const body = sceneSource.slice(sceneSource.indexOf(method)).split('\n\t}')[0];
  expect(body).toContain('this.board.reset()');
 }
});
it('reduced motion preserves callback order, capture selection, and immediate promotion without tweens', () => {
 const h = harness(true), order: string[] = [];
 const start = { row: 6, col: 0 }, crown = { row: 7, col: 1 };
 h.board.sync(position('man', 'white', start), [start], start);
 expect(h.sprite().texture.key).toBe('selection_white-55');
 h.board.playMove({ from: start, path: [crown] }, () => {
  order.push('done'); h.board.sync(position('king', 'white', crown), [crown], crown);
 }, () => order.push('land'), () => order.push('takeoff'), true);
 expect(order).toEqual(['takeoff', 'land', 'done']);
 expect(h.tweens).toHaveLength(0);
 expect(h.sprite().texture.key).toBe('selection_white-55');
 expect(h.sprite().data.progress).toBe(1);
 h.board.sync(position('king', 'white', crown), [], null);
 expect(h.sprite().data.progress).toBe(0);
});
it('removes an assembling piece without resurrection or interference with a new selection', () => {
 const h = harness();
 h.board.sync(position(), [from], from); h.tick(650);
 const old = h.sprite();
 h.board.sync(position(), [], null); h.tick(100);
 h.board.sync(position('man', 'black', land), [land], land); h.tick(650);
 expect(old.destroyed).toBe(true);
 expect(h.sprite().texture.key).toBe('selection_black-55');
 expect(h.objects.filter(o => o.name === 'selection-piece' && !o.destroyed)).toHaveLength(1);
});
it('logical king shares v2 closed/selected/reverse body and keeps temporary rank seal', () => {
 const h=harness();h.board.sync(position('king'),[from],null);
 expect(h.sprite().texture.key).toBe('selection_white-00');
 const seal=h.objects.find(o=>o.name==='king-seal');const y=seal.y;
 expect(seal.visible).toBe(true);h.board.sync(position('king'),[from],from);h.tick(650);
 expect(h.sprite().texture.key).toBe('selection_white-55');expect(seal.y).toBeLessThan(y);
 h.board.sync(position('king'),[from],null);h.tick(650);
 expect(h.sprite().texture.key).toBe('selection_white-00');expect(seal.y).toBeCloseTo(y);
});
it('renders exact individually delivered frames at a fixed body pivot, holds selection, and preserves kind', () => {
 const h = harness();
 h.board.sync(position(), [from], from);
 expect(h.sprite()?.texture.key).toBe('selection_white-00');
 expect(h.sprite().originX).toBeCloseTo(365 / 724);
 expect(h.sprite().originY).toBeCloseTo(679 / 724);
 h.tick(650);
 expect(h.sprite().texture.key).toBe('selection_white-55');
 expect(h.sprite().data.kind).toBe('man');
 const y = h.sprite().y, w = h.sprite().displayWidth;
 h.tick(3000);
 expect(h.sprite().texture.key).toBe('selection_white-55');
 expect(h.sprite().y).toBe(y);
 expect(h.sprite().displayWidth).toBe(w);
});
