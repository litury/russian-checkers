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

function harness(reduced = false, blocked: () => boolean = () => false, texturesReady = true) {
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
  textures: { get: () => ({ setFilter() {} }), exists: texturesReady ? undefined : () => false },
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
 expect(piece.texture.key).toBe('manLight');
 expect(piece.texture.key).not.toMatch(/^selection_/);
 expect(piece.data.progress).toBe(0);
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
 expect(h.sprite().texture.key).toBe('manLight');
 expect(h.sprite().data.progress).toBe(1);
 h.tick(1);
 expect(h.sprite().texture.key).toBe('manLight');
 expect(h.sprite().data.progress).toBe(1);
 h.tick(5000);
 expect(h.sprite().texture.key).toBe('manLight');
 expect(h.sprite().data.progress).toBe(1);
 const end = { row: 4, col: 2 };
 h.board.playMove({ from: land, path: [end] }, () => h.board.sync(position('man', 'white', end), [], null), undefined, undefined, true);
 h.tick(80);
 expect(h.sprite().texture.key).toBe('manLight');
 expect(h.sprite().data.progress).toBe(1);
 h.finish();
 h.tick(650);
 expect(h.sprite().texture.key).toBe('manLight');
 expect(h.sprite().data.progress).toBe(0);
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
 expect(h.sprite().texture.key).toBe(side === 'white' ? 'kingLight' : 'kingDark');
 expect(h.sprite().texture.key).not.toMatch(/^selection_/);
 expect(h.sprite().originX).toBe(0.5);
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
 expect(h.sprite().texture.key).toBe('manLight');
 expect(h.sprite().data.progress).toBe(action === 'shutdown' ? 0 : 1);
});
it('end and resignation invalidate old board work before presenting the final position', () => {
 for (const method of ['private endMatch(', 'resignMatch():']) {
  const body = sceneSource.slice(sceneSource.indexOf(method)).split('\n\t}')[0];
  expect(body).toContain('this.board.reset(');
 }
 // Only the promotion that ended the match keeps its fire; a resignation has none to present.
 const end = sceneSource.slice(sceneSource.indexOf('private endMatch(')).split('\n\t}')[0];
 const resign = sceneSource.slice(sceneSource.indexOf('resignMatch():')).split('\n\t}')[0];
 expect(end).toContain('keepPromotionFire: true');
 expect(resign).not.toContain('keepPromotionFire');
});
it('keeps the final promotion burning through the presentation reset, then clears it with the next match', () => {
 let blocked = false;
 const h = harness(false, () => blocked);
 const start = { row: 6, col: 0 }, crown = { row: 7, col: 1 };
 h.board.sync(position('man', 'white', start), [start], start);
 h.board.playMove({ from: start, path: [crown] }, () => {}, undefined, undefined, true);
 h.finish();
 expect(fire(h, 'ignite')).toHaveLength(2);
 // The match ends: the board resets for the presentation and input is blocked behind the result window.
 h.board.reset({ keepPromotionFire: true });
 blocked = true;
 h.board.sync(position('king', 'white', crown), [], null);
 h.tick(1);
 expect(fire(h, 'ignite')).toHaveLength(2);
 expect(fire(h, 'idle')).toHaveLength(0);
 h.tick(600);
 expect(fire(h, 'ignite')).toHaveLength(2);
 h.tick(700);
 expect(fire(h, 'ignite')).toHaveLength(0);
 expect(fire(h, 'idle')).toHaveLength(2);
 // A new match clears it without a trace.
 h.board.reset();
 h.tick(1);
 for (const mode of ['idle', 'ignite', 'static', 'trail', 'moving']) expect(fire(h, mode)).toHaveLength(0);
});
it('a presentation reset without a last-move promotion still clears the fire', () => {
 let blocked = false;
 const h = harness(false, () => blocked);
 h.board.sync(position('king'), [from], from);
 expect(fire(h, 'idle')).toHaveLength(2);
 h.board.reset({ keepPromotionFire: true });
 blocked = true;
 h.board.sync(position('king'), [], null);
 h.tick(1);
 expect(fire(h, 'idle')).toHaveLength(0);
 expect(fire(h, 'ignite')).toHaveLength(0);
});
it('does not present the fire of a promotion that is not the last move', () => {
 const h = harness();
 const start = { row: 6, col: 0 }, crown = { row: 7, col: 1 }, after = { row: 5, col: 2 };
 h.board.sync(position('man', 'white', start), [start], start);
 h.board.playMove({ from: start, path: [crown] }, () => {}, undefined, undefined, true);
 h.finish();
 h.board.sync(position('king', 'white', crown), [crown], crown);
 h.board.playMove({ from: crown, path: [after] }, () => {}, undefined, undefined, true);
 h.finish();
 h.board.reset({ keepPromotionFire: true });
 h.tick(1);
 expect(fire(h, 'idle')).toHaveLength(0);
 expect(fire(h, 'ignite')).toHaveLength(0);
});
it('keeps the final promotion across a resize but not across a hidden playfield', () => {
 const h = harness(false, () => true);
 const start = { row: 6, col: 0 }, crown = { row: 7, col: 1 };
 h.board.sync(position('man', 'white', start), [start], start);
 h.board.playMove({ from: start, path: [crown] }, () => {}, undefined, undefined, true);
 h.finish();
 h.board.reset({ keepPromotionFire: true });
 h.board.sync(position('king', 'white', crown), [], null);
 h.tick(1);
 expect(fire(h, 'ignite')).toHaveLength(2);
 h.board.layout(800, 600);
 expect(fire(h, 'ignite')).toHaveLength(2);
 h.board.setPlayfieldVisible(false);
 h.board.setPlayfieldVisible(true);
 h.board.sync(position('king', 'white', crown), [], null);
 h.tick(1);
 for (const mode of ['idle', 'ignite', 'static']) expect(fire(h, mode)).toHaveLength(0);
});
it('reduced motion presents the final promotion as a static flame', () => {
 const h = harness(true, () => true);
 const start = { row: 6, col: 0 }, crown = { row: 7, col: 1 };
 h.board.sync(position('man', 'white', start), [start], start);
 // Reduced motion lands and promotes synchronously, without a tween to complete.
 h.board.playMove({ from: start, path: [crown] }, () => {}, undefined, undefined, true);
 expect(fire(h, 'static')).toHaveLength(1);
 h.board.reset({ keepPromotionFire: true });
 h.board.sync(position('king', 'white', crown), [], null);
 h.tick(1);
 expect(fire(h, 'static')).toHaveLength(1);
 expect(fire(h, 'ignite')).toHaveLength(0);
});
it('reduced motion preserves callback order, capture selection, and immediate promotion without tweens', () => {
 const h = harness(true), order: string[] = [];
 const start = { row: 6, col: 0 }, crown = { row: 7, col: 1 };
 h.board.sync(position('man', 'white', start), [start], start);
 expect(h.sprite().texture.key).toBe('manLight');
 expect(h.sprite().data.progress).toBe(1);
 h.board.playMove({ from: start, path: [crown] }, () => {
  order.push('done'); h.board.sync(position('king', 'white', crown), [crown], crown);
 }, () => order.push('land'), () => order.push('takeoff'), true);
 expect(order).toEqual(['takeoff', 'land', 'done']);
 expect(h.tweens).toHaveLength(0);
 expect(h.sprite().texture.key).toBe('kingLight');
 expect(h.sprite().texture.key).not.toMatch(/^selection_/);
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
 expect(h.sprite().texture.key).toBe('manDark');
 expect(h.sprite().texture.key).not.toMatch(/^selection_/);
 expect(h.objects.filter(o => o.name === 'selection-piece' && !o.destroyed)).toHaveLength(1);
});
it('keeps the real king texture and a still seal; selection does not lift or bleach the piece', () => {
 const h=harness();h.board.sync(position('king'),[from],null);
 expect(h.sprite().texture.key).toBe('kingLight');
 const seal=h.objects.find(o=>o.name==='king-seal');const y=seal.y;
 expect(seal.visible).toBe(true);h.board.sync(position('king'),[from],from);h.tick(650);
 expect(h.sprite().texture.key).toBe('kingLight');expect(seal.y).toBe(y);
 h.board.sync(position('king'),[from],null);h.tick(650);
 expect(h.sprite().texture.key).toBe('kingLight');expect(seal.y).toBeCloseTo(y);
});
it('keeps the real piece texture while selected, at a fixed pivot, and preserves kind', () => {
 const h = harness();
 h.board.sync(position(), [from], from);
 expect(h.sprite()?.texture.key).toBe('manLight');
 expect(h.sprite().originX).toBe(0.5);
 expect(h.sprite().originY).toBe(0.5);
 h.tick(650);
 expect(h.sprite().texture.key).toBe('manLight');
 expect(h.sprite().data.kind).toBe('man');
 const y = h.sprite().y, w = h.sprite().displayWidth;
 h.tick(3000);
 expect(h.sprite().texture.key).toBe('manLight');
 expect(h.sprite().y).toBe(y);
 expect(h.sprite().displayWidth).toBe(w);
 });
const overlay = (h: ReturnType<typeof harness>) =>
 h.objects.find(o => o.name === 'selection-overlay' && !o.destroyed);
const group = (h: ReturnType<typeof harness>) =>
 h.objects.find(o => o.name === 'selection-piece-group' && !o.destroyed);
it('never points the layer at a missing texture while the pack is still loading', () => {
 const h = harness(false, () => false, false);
 h.board.sync(position(), [from], from);
 h.tick(650);
 const layer = overlay(h);
 // Lazy pack absent: the layer keeps a live texture and stays hidden, never __MISSING.
 expect(layer.texture.key).toBe('manLight');
 expect(layer.visible).toBe(false);
 expect(layer.data.frame).toBe('hold-01');
 expect(h.sprite().texture.key).toBe('manLight');
 expect(h.objects.find(o => o.name === 'king-seal').visible).toBe(false);
});
it('lays the selection overlay above the sprite, cell-sized, hidden at rest', () => {
 const h = harness();
 h.board.sync(position(), [from], null);
 const layer = overlay(h), piece = h.sprite();
 expect(layer).toBeTruthy();
 const children = group(h).children;
 expect(children.indexOf(layer)).toBeGreaterThan(children.indexOf(piece));
 expect(children[children.length - 1]).toBe(layer);
 expect(layer.visible).toBe(false);
 expect(layer.data.frame).toBe('none');
 expect(layer.displayWidth).toBe(44);
 expect(layer.displayHeight).toBe(44);
 expect(layer.originX).toBe(0.5);
 expect(piece.texture.key).toBe('manLight');
});
it('drives the overlay frames from the selection progress on both ladders', () => {
 const h = harness();
 h.board.sync(position(), [from], from);
 h.tick(1);
 expect(overlay(h).visible).toBe(true);
 expect(overlay(h).data.frame).toBe('enter-01');
 const opening: string[] = [];
 for (let i = 0; i < 13; i++) { h.tick(50); opening.push(overlay(h).data.frame); }
 for (const frame of ['enter-01', 'enter-02', 'enter-03', 'enter-04']) expect(opening).toContain(frame);
 expect(opening[opening.length - 1]).toBe('hold-01');
 expect(opening.indexOf('enter-02')).toBeGreaterThan(opening.indexOf('enter-01'));
 expect(opening.indexOf('enter-03')).toBeGreaterThan(opening.indexOf('enter-02'));
 expect(opening.indexOf('enter-04')).toBeGreaterThan(opening.indexOf('enter-03'));
 h.board.sync(position(), [from], null);
 const closing: string[] = [];
 for (let i = 0; i < 13; i++) { h.tick(50); closing.push(overlay(h).data.frame); }
 expect(closing[0]).toBe('exit-01');
 for (const frame of ['exit-02', 'exit-03']) expect(closing).toContain(frame);
 expect(closing[closing.length - 1]).toBe('none');
 expect(closing.indexOf('exit-02')).toBeGreaterThan(closing.indexOf('exit-01'));
 expect(closing.indexOf('exit-03')).toBeGreaterThan(closing.indexOf('exit-02'));
 expect(overlay(h).visible).toBe(false);
 // The piece itself never changes texture or pivot while the overlay animates.
 expect(h.sprite().texture.key).toBe('manLight');
 expect(h.sprite().originX).toBe(0.5);
});
it('carries the overlay with the piece group through a move and closes after landing', () => {
 const h = harness();
 h.board.sync(position(), [from], from);
 h.tick(650);
 expect(overlay(h).data.frame).toBe('hold-01');
 const layer = overlay(h);
 h.board.playMove({ from, path: [land] }, () => h.board.sync(position('man', 'white', land), [], null));
 const tween = h.tweens[0];
 expect(tween.targets.name).toBe('selection-piece-group');
 expect(tween.targets.children).toContain(layer);
 h.tick(80);
 expect(overlay(h).data.frame).toBe('hold-01');
 h.finish();
 expect(h.sprite().data.square).toEqual(land);
 expect(overlay(h).data.frame).toBe('hold-01');
 h.tick(650);
 expect(overlay(h).data.frame).toBe('none');
 expect(overlay(h).visible).toBe(false);
});
it('reduced motion jumps straight to the hold frame and clears the layer at once', () => {
 const h = harness(true);
 h.board.sync(position(), [from], from);
 expect(h.sprite().data.progress).toBe(1);
 expect(overlay(h).data.frame).toBe('hold-01');
 h.board.sync(position(), [from], null);
 expect(h.sprite().data.progress).toBe(0);
 expect(overlay(h).data.frame).toBe('none');
 expect(overlay(h).visible).toBe(false);
 expect(h.tweens).toHaveLength(0);
});
it('keeps one overlay layer per piece and destroys it with the piece', () => {
 const h = harness();
 h.board.sync(position(), [from], from);
 h.tick(650);
 const first = overlay(h);
 expect(first.visible).toBe(true);
 expect(group(h).children).toContain(first);
 h.board.sync(position(), [from], from);
 h.tick(100);
 expect(overlay(h)).toBe(first);
 expect(h.objects.filter(o => o.name === 'selection-overlay' && !o.destroyed)).toHaveLength(1);
 h.board.reset();
 expect(first.destroyed).toBe(true);
 expect(h.objects.filter(o => o.name === 'selection-overlay' && !o.destroyed)).toHaveLength(0);
});
 it('shows one rotated arrow only after selection, and amber brackets on the piece and the landing', () => {
 const h = harness();
 const arrows = () => h.objects.filter(o => o.visible && !o.destroyed && o.name === 'marker_arrow_amber');
 const staples = () => h.objects.filter(o => o.visible && !o.destroyed && o.name === 'marker_staples_amber');
 const circles = () => h.objects.filter(o => o.visible && !o.destroyed && String(o.name).includes('circle'));
 h.board.sync(position(), [from], null);
 expect(arrows()).toHaveLength(0);
 expect(staples()).toHaveLength(0);
 h.board.sync(position(), [from], from, [{ from, path: [land] }]);
 expect(h.sprite().texture.key).toBe('manLight');
 expect(staples()).toHaveLength(2);
 expect(staples().some(s => s.x === 22 && s.displayWidth === 44)).toBe(true);
 const landing = staples().find(s => s.x === (1 + 0.5) * 44);
 expect(landing.y).toBe((7.5 - 3) * 44);
 expect(circles()).toHaveLength(0);
 expect(arrows()).toHaveLength(1);
 expect(arrows()[0].x).toBeCloseTo(22 + 44 * 0.55);
 expect(arrows()[0].y).toBeLessThan(242);
 expect(arrows()[0].rotation).toBeCloseTo(Math.atan2(-1, 1) - Math.atan2(132 - 91.5, 160 - 97));
 const mid = { row: 2, col: 2 };
 const squares = Array.from({ length: 8 }, () => Array(8).fill(null));
 squares[2][2] = { kind: 'man', side: 'white' };
 h.board.sync({ squares, turn: 'white' }, [mid], mid, [
 	{ from: mid, path: [{ row: 3, col: 1 }] },
 	{ from: mid, path: [{ row: 3, col: 3 }] },
 ]);
 expect(arrows()).toHaveLength(2);
 expect(staples()).toHaveLength(3);
 expect(new Set(arrows().map(a => a.rotation)).size).toBe(2);
 h.board.setFacing('black');
 h.board.sync(position(), [from], from, [{ from, path: [land] }]);
 expect(arrows()).toHaveLength(1);
 expect(arrows()[0].y).toBeCloseTo((2 + 0.5) * 44 + 44 * 0.55);
 expect(staples().find(s => s.x === (1 + 0.5) * 44).y).toBeCloseTo((3 + 0.5) * 44);
 expect(circles()).toHaveLength(0);
 });
 it('keeps a bracket on every far king landing and an arrow in the empty chain cell, not on the victim', () => {
 const h = harness();
 const origin = { row: 2, col: 2 };
 const squares = Array.from({ length: 8 }, () => Array(8).fill(null));
 squares[2][2] = { kind: 'king', side: 'white' };
 squares[3][3] = { kind: 'man', side: 'black' };
 squares[5][3] = { kind: 'man', side: 'black' };
 h.board.sync({ squares, turn: 'white' }, [origin], origin, [
 	{ from: origin, path: [{ row: 4, col: 4 }] },
 	{ from: origin, path: [{ row: 5, col: 5 }] },
 	{ from: origin, path: [{ row: 4, col: 4 }, { row: 6, col: 2 }] },
 ]);
 expect(h.sprite().texture.key).toBe('kingLight');
 const copper = h.objects.filter(o => o.visible && !o.destroyed && o.name === 'marker_staples_copper');
 const arrows = h.objects.filter(o => o.visible && !o.destroyed && o.name === 'marker_arrow_copper');
 expect(copper.map(c => `${c.x},${c.y}`).sort()).toEqual([
 	`${(4 + 0.5) * 44},${(7.5 - 4) * 44}`,
 	`${(5 + 0.5) * 44},${(7.5 - 5) * 44}`,
 	`${(2 + 0.5) * 44},${(7.5 - 6) * 44}`,
 ].sort());
 const cuts = h.objects.filter(o => o.visible && !o.destroyed && o.name === 'marker_cut');
 expect(cuts.map(c => `${c.x},${c.y}`).sort()).toEqual([
 	`${(3 + 0.5) * 44},${(7.5 - 3) * 44}`,
 	`${(3 + 0.5) * 44},${(7.5 - 5) * 44}`,
 ].sort());
 expect(cuts.find(c => c.x === (3 + 0.5) * 44 && c.y === (7.5 - 3) * 44).rotation)
 	.toBeCloseTo(Math.atan2(-1, 1) - Math.PI / 4);
 expect(cuts.find(c => c.y === (7.5 - 5) * 44).rotation)
 	.toBeCloseTo(Math.atan2(-1, -1) - Math.PI / 4);
 expect(arrows).toHaveLength(2);
 const chain = arrows.find(a => Math.abs(a.x - ((4 + 0.5) * 44 - 44 * 0.55)) < 1);
 expect(chain).toBeTruthy();
 expect(chain.y).toBeCloseTo((7.5 - 4) * 44 - 44 * 0.55);
 for (const victim of [{ row: 3, col: 3 }, { row: 5, col: 3 }]) {
 	const x = (victim.col + 0.5) * 44;
 	const y = (7.5 - victim.row) * 44;
 	expect(arrows.some(a => Math.abs(a.x - x) < 8 && Math.abs(a.y - y) < 8)).toBe(false);
 }
 expect(h.objects.filter(o => o.visible && String(o.name).includes('circle'))).toHaveLength(0);
 });
