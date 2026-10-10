import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { KingFire } from './kingFire';
import { kingFireAssets, kingFireSheets, type KingFireSheet, kingFireTextureReady, preloadKingFire } from './kingFireAssets';
vi.mock('@/client/app/kingFireSfx', () => ({ kingFireIgniteSfx: vi.fn(), kingFireTrailSfx: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
function harness(present = true, frames?: number) {
 const listeners = new Map<string, (...args: any[]) => void>();
 const sprites: any[] = [];
 const scene: any = {
  textures: { exists: () => present, get: (key: string) => ({ frameTotal: frames ?? kingFireSheets[key.replace('king-fire_', '') as KingFireSheet].frames + 1 }) },
  load: { on: vi.fn((name, fn) => listeners.set(name, fn)), once: vi.fn((name, fn) => listeners.set(name, fn)), off: vi.fn(), spritesheet: vi.fn() },
  add: { sprite: vi.fn(() => {
   const s: any = { frame: 0, destroyed: false };
   for (const name of ['setPosition','setScale','setDepth','setName','setData','setOrigin','setCrop','setVisible','setActive','setRotation','setAlpha']) s[name] = vi.fn(() => s);
   s.setFrame = vi.fn((frame) => { s.frame = frame; return s; });
   s.destroy = () => { s.destroyed = true; };
   sprites.push(s); return s;
  }) },
 };
 return { scene, listeners, sprites };
}
it('loads each restored contour sheet with its complete metadata frame range', () => {
 const h = harness(); preloadKingFire(h.scene);
 expect(new Set(Object.values(kingFireAssets)).size).toBe(6);
 expect(kingFireAssets.static).toContain('king-fire/static.webp');
 expect(h.scene.load.spritesheet).toHaveBeenCalledTimes(6);
 for (const call of h.scene.load.spritesheet.mock.calls) {
  const sheet = kingFireSheets[call[0].replace('king-fire_', '') as KingFireSheet];
  expect(call[2]).toEqual({ frameWidth: sheet.width, frameHeight: sheet.height, endFrame: sheet.frames - 1 });
 }
 const log = vi.spyOn(console, 'error').mockImplementation(() => {});
 h.listeners.get('complete')!(); expect(log).not.toHaveBeenCalled();
 expect(h.scene.load.off).toHaveBeenCalled();
});
it.each([[false, 9], [true, 4]])('reports missing or truncated sheet at load completion (%s/%s)', (present, frames) => {
 const h = harness(present, frames), log = vi.spyOn(console, 'error').mockImplementation(() => {});
 preloadKingFire(h.scene); h.listeners.get('complete')!();
 expect(log).toHaveBeenCalledTimes(6);
 expect(kingFireTextureReady(h.scene, 'idle-front')).toBe(false);
 h.listeners.get('loaderror')!({ key: 'king-fire_idle-front' });
 expect(log).toHaveBeenLastCalledWith('[king-fire] sheet load failed', 'king-fire_idle-front');
 h.listeners.get('loaderror')!({ key: 'unrelated' }); expect(log).toHaveBeenCalledTimes(7);
});
// Silent rendering guards are separate from 0c16917 bootstrap routes.
it.each(['rest', 'ignite', 'takeoff'] as const)('logs the unavailable %s branch once without creating broken sprites', (method) => {
 const h = harness(false), log = vi.spyOn(console, 'warn').mockImplementation(() => {});
 const fire = new KingFire(h.scene), id = {}, point = { x: 0, y: 0 };
 const run = () => method === 'ignite' ? fire.ignite(id, point, 44, false) : fire[method](id, true, point, 44, false);
 run(); run(); expect(log).toHaveBeenCalledTimes(1); expect(h.scene.add.sprite).not.toHaveBeenCalled();
});
it.each(['rest', 'ignite', 'takeoff'] as const)('rejects incomplete frames in %s rather than playing nonexistent frames', (method) => {
 const h = harness(true, 3), log = vi.spyOn(console, 'warn').mockImplementation(() => {}), fire = new KingFire(h.scene);
 if (method === 'ignite') fire.ignite({}, { x: 0, y: 0 }, 44, false);
 else fire[method]({}, true, { x: 0, y: 0 }, 44, false);
 expect(log).toHaveBeenCalled(); expect(h.sprites).toHaveLength(0);
});
it('advances all twenty idle frames sequentially then wraps, with reduced motion static', () => {
 const h = harness(), fire = new KingFire(h.scene), id = {};
 fire.rest(id, true, { x: 10, y: 20 }, 44, false);
 const frames = [h.sprites[0].frame];
 for (let i = 0; i < 20; i++) { fire.update(100); frames.push(h.sprites[0].frame); }
 expect(frames).toEqual([...Array.from({length:20}, (_,i) => i),0]);
 fire.update(0, true); const staticSprite = h.sprites.at(-1); fire.update(9000, true);
 expect(staticSprite.frame).toBe(0);
});
it('recovers every standing king and a promotion via update only, without refresh or player input', () => {
 const h = harness(false), fire = new KingFire(h.scene), ids = [{}, {}, {}];
 vi.spyOn(console, 'warn').mockImplementation(() => {});
 ids.forEach((id, i) => fire.rest(id, true, { x: i * 44, y: 0 }, 44, false));
 fire.ignite(ids[2], { x: 88, y: 0 }, 44, false);
 expect(h.sprites).toHaveLength(0);
 h.scene.textures.exists = () => true; fire.update(16);
 expect(h.sprites).toHaveLength(8); // 3 pairs idle + one deferred promotion burst
 fire.update(1300); expect(h.sprites.filter(s => !s.destroyed)).toHaveLength(6);
});
it.each(['remove','clear'] as const)('does not resurrect canceled pending effects after %s', method => {
 const h = harness(false), fire = new KingFire(h.scene), id = {};
 vi.spyOn(console, 'warn').mockImplementation(() => {});
 fire.rest(id, true, { x: 0, y: 0 }, 44, false); fire.ignite(id, { x: 0, y: 0 }, 44, false);
 if (method === 'remove') fire.remove(id); else fire.clear();
 h.scene.textures.exists = () => true; fire.update(16); expect(h.sprites).toHaveLength(0);
});
it('preserves a pending final promotion across presentation reset, but not full reset', () => {
 const h = harness(false), fire = new KingFire(h.scene), id = {};
 vi.spyOn(console, 'warn').mockImplementation(() => {});
 fire.rest(id, true, { x: 0, y: 0 }, 44, false); fire.ignite(id, { x: 0, y: 0 }, 44, false);
 fire.keep(id); fire.clear(true); fire.remove(id);
 h.scene.textures.exists = () => true; fire.update(16); expect(h.sprites).toHaveLength(4);
 fire.clear(); expect(h.sprites.every(s => s.destroyed)).toBe(true);
});
it('recovers standing fire when a background load eventually becomes available', () => {
 const h = harness(false), log = vi.spyOn(console, 'warn').mockImplementation(() => {}), fire = new KingFire(h.scene), id = {};
 fire.rest(id, true, { x: 0, y: 0 }, 44, false);
 h.scene.textures.exists = () => true;
 fire.rest(id, true, { x: 0, y: 0 }, 44, false);
 expect(h.sprites).toHaveLength(2); expect(log).toHaveBeenCalledTimes(1);
});
it('plays every ignition frame exactly once then reveals perpetual idle', () => {
 const h = harness(), fire = new KingFire(h.scene), id = {};
 fire.rest(id, true, { x: 10, y: 20 }, 44, false);
 fire.ignite(id, { x: 10, y: 20 }, 44, false);
 const seen = [h.sprites[2].frame];
 for (let i = 1; i < 12; i++) {
  fire.update(100); seen.push(h.sprites[2].frame);
  expect(h.sprites[3].frame).toBe(i);
 }
 expect(seen).toEqual(Array.from({length:12}, (_,i) => i));
 expect(h.sprites[2].destroyed).toBe(false);
 fire.update(100);
 expect(h.sprites.slice(2).every(s => s.destroyed)).toBe(true);
 expect(h.sprites[0].setVisible).toHaveBeenLastCalledWith(true);
 fire.update(60000);
 expect(h.sprites[0].destroyed).toBe(false);
});
it('registers contour layers from sheet pivot without cropping the art', () => {
 const h = harness(), fire = new KingFire(h.scene), id = {};
 fire.rest(id, true, {x:12,y:34}, 66, false);
 for (const sprite of h.sprites) {
  expect(sprite.setOrigin).toHaveBeenCalledWith(32/64,46/80);
  expect(sprite.setScale).toHaveBeenCalledWith(66/44);
  expect(sprite.setCrop).not.toHaveBeenCalled();
 }
});
it.each(Object.keys(kingFireAssets) as KingFireSheet[])('metadata matches actual lossless WebP dimensions for %s', name => {
 const url = new URL(kingFireAssets[name]);
 const bytes = readFileSync(url);
 expect(bytes.toString('ascii',0,4)).toBe('RIFF');
 expect(bytes.toString('ascii',8,12)).toBe('WEBP');
 let offset = 12;
 while (bytes.toString('ascii',offset,offset+4) !== 'VP8L' && offset < bytes.length)
  offset += 8 + bytes.readUInt32LE(offset+4) + (bytes.readUInt32LE(offset+4) % 2);
 expect(bytes.toString('ascii',offset,offset+4)).toBe('VP8L');
 const bits = bytes.readUInt32LE(offset+9), sheet = kingFireSheets[name];
 expect((bits & 0x3fff)+1).toBe(sheet.width * sheet.columns);
 expect(((bits >>> 14)&0x3fff)+1).toBe(sheet.height * Math.ceil(sheet.frames/sheet.columns));
});
