import type Phaser from 'phaser';
import { kingFireIgniteSfx, kingFireTrailSfx } from '@/client/app/kingFireSfx';

export type FirePoint = { x: number; y: number };
type Sprite = Phaser.GameObjects.Sprite;
type Rest = { sprites: Sprite[]; point: FirePoint; cell: number; reduced: boolean };
type Burst = { owner: object; sprites: Sprite[]; point: FirePoint; age: number };
type Deposit = { sprite: Sprite; age: number; angle: number };
export const KING_FIRE_TRAIL_LIMIT = 128;
export const KING_FIRE_SPACING = 16;

/** Baked v3 RGBA only, in world coordinates, never inside a piece container. */
export class KingFire {
 private idle = new Map<object, Rest>();
 private bursts: Burst[] = [];
 private moving: Sprite | null = null;
 private previous: FirePoint | null = null;
 private remaining = 0;
 private cell = 44;
 private elapsed = 0;
 private pool: Deposit[] = [];
 private motionReduced = false;
 private owner: object | null = null;
 private serial = 0;
 /** Owner whose fire survives the presentation reset that ends a match. */
 private kept: object | null = null;
 constructor(private scene: Phaser.Scene) {}

 private has(texture: string): boolean {
  // Harness without exists() treats sheets as present; live path checks TextureManager.
  if (typeof this.scene.textures?.exists !== 'function') return true;
  return this.scene.textures.exists(`king-fire_${texture}`);
 }
 private sprite(texture: string, p: FirePoint, cell: number, depth: number, mode: string) {
  const layer = texture.endsWith('-back') ? 'back' : texture.endsWith('-front') ? 'front' : mode;
  return this.scene.add.sprite(p.x, p.y, `king-fire_${texture}`, 0)
   // Cell top-left=(10,24); its center=(32,46) in each64x80 frame.
   .setOrigin(0.5, 46 / 80).setScale(cell / 44).setDepth(depth)
   .setName(`king-fire-${layer}`).setData('mode', mode).setData('cell', cell);
 }
 private dropIdle(id: object) {
  this.idle.get(id)?.sprites.forEach(s => s.destroy()); this.idle.delete(id);
 }
 rest(id: object, king: boolean, p: FirePoint, cell: number, reduced: boolean) {
  if (!king) { this.remove(id); return; }
  // Sheets may still be background-loading; skip VFX until ready.
  if (!(reduced ? this.has('static') : this.has('idle-back') && this.has('idle-front'))) return;
  if (this.idle.get(id)?.reduced !== reduced) this.dropIdle(id);
  if (!this.idle.has(id)) this.idle.set(id, {
   point: { x: p.x, y: p.y }, cell, reduced,
   sprites: reduced ? [this.sprite('static', p, cell, 3.9, 'static')]
    : [this.sprite('idle-back', p, cell, 3.9, 'idle'), this.sprite('idle-front', p, cell, 4.1, 'idle')],
  });
  const rest = this.idle.get(id)!;
  rest.point = { x: p.x, y: p.y }; rest.cell = cell;
  const igniting = this.bursts.some(b => b.owner === id && b.point.x === p.x && b.point.y === p.y);
  for (const s of rest.sprites) s.setPosition(p.x, p.y).setScale(cell / 44).setVisible(!igniting);
 }
 ignite(owner: object, p: FirePoint, cell: number, reduced: boolean) {
  if (reduced) return;
  if (!this.has('ignite-back') || !this.has('ignite-front')) return;
  kingFireIgniteSfx(false);
  this.bursts.push({ owner, point: { x: p.x, y: p.y }, age: 0,
   sprites: [this.sprite('ignite-back', p, cell, 3.9, 'ignite'), this.sprite('ignite-front', p, cell, 4.1, 'ignite')],
  });
 }
 takeoff(id: object, king: boolean, p: FirePoint, cell: number, reduced: boolean) {
  // The logical promotion already happened; nothing square-shaped travels.
  this.remove(id); this.land();
  if (!king || reduced) return;
  if (!this.has('trail')) return;
  kingFireTrailSfx(true, false);
  if (this.owner !== id || this.cell !== cell) this.remaining = KING_FIRE_SPACING * cell / 44;
  this.owner = id; this.cell = cell;
  this.previous = { x: p.x, y: p.y };
  this.moving = this.sprite('trail', p, cell, 4.1, 'moving').setOrigin(0.5, 48 / 80);
 }
 move(p: FirePoint, delta = 0) {
  if (!this.moving || !this.previous) return;
  const start = this.previous, dx = p.x - start.x, dy = p.y - start.y;
  const distance = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
  const spacing = KING_FIRE_SPACING * this.cell / 44;
  if (distance > 0) {
   let along = this.remaining;
   while (along <= distance + 1e-7) {
    this.deposit({ x: start.x + dx * along / distance, y: start.y + dy * along / distance }, angle, Math.max(0, delta) * (1 - along / distance));
    along += spacing;
   }
   this.remaining = along - distance;
  }
  this.previous = { x: p.x, y: p.y };
  this.moving.setPosition(p.x, p.y);
 }
 private deposit(p: FirePoint, angle: number, age: number) {
  const n = this.serial++;
  const variation = ((Math.imul(n + 1, 1664525) + 1013904223) >>> 0) / 4294967296;
  const offset = (Math.sin(n * 2.399963) * 4.5) * this.cell / 44;
  const size = (0.8 + variation * 0.2) * this.cell / 44;
  p = { x: p.x - Math.sin(angle) * offset, y: p.y + Math.cos(angle) * offset };
  let drop = this.pool.find(d => d.age >= 2500);
  if (!drop && this.pool.length >= KING_FIRE_TRAIL_LIMIT) drop = this.pool.reduce((a, b) => a.age >= b.age ? a : b);
  if (!drop) {
   drop = { sprite: this.sprite('trail', p, this.cell, 3.9, 'trail').setOrigin(0.5, 48 / 80), age: 0, angle };
   this.pool.push(drop);
  }
  drop.age = Math.max(0, age); drop.angle = angle;
  drop.sprite.setPosition(p.x, p.y).setScale(size).setFrame(Math.min(24, Math.floor(drop.age / 100))).setRotation(0)
   .setVisible(true).setActive(true).setData('age', drop.age).setData('angle', angle).setData('variation', variation);
 }
 land() { this.moving?.destroy(); this.moving = null; this.previous = null; }
 update(delta: number, reduced = false) {
  if (reduced !== this.motionReduced) {
   this.motionReduced = reduced;
   if (reduced) this.clearTransient();
   for (const [id, rest] of [...this.idle]) this.rest(id, true, rest.point, rest.cell, reduced);
  }
  this.elapsed += Math.max(0, delta);
  for (const rest of this.idle.values()) if (!rest.reduced)
   rest.sprites.forEach(s => s.setFrame(Math.floor(this.elapsed / 100) % 20));
  this.moving?.setFrame(Math.floor(this.elapsed / 100) % 5);
  for (const burst of this.bursts) {
   burst.age += Math.max(0, delta);
   if (burst.age >= 1200) burst.sprites.forEach(s => s.destroy());
   else burst.sprites.forEach(s => s.setFrame(Math.floor(burst.age / 100)).setData('age', burst.age));
  }
  this.bursts = this.bursts.filter(b => b.age < 1200);
  for (const [id, rest] of this.idle) {
   const igniting = this.bursts.some(b => b.owner === id && b.point.x === rest.point.x && b.point.y === rest.point.y);
   rest.sprites.forEach(s => s.setVisible(!igniting));
  }
  for (const drop of this.pool) {
   drop.age += Math.max(0, delta);
   if (drop.age >= 2500) { drop.sprite.setVisible(false).setActive(false); continue; }
   const frame = Math.floor(drop.age / 100);
   // The bake contains550ms flame,400–1300ms embers,950–2500ms soot.
   // Keep flame upright; align the mature soot with the movement diagonal.
   drop.sprite.setFrame(frame).setRotation(frame >= 10 ? drop.angle + Math.PI / 4 : 0).setData('age', drop.age);
  }
 }
 remove(id: object) {
  // A kept owner outlives its piece view: the final promotion keeps its flame.
  if (id === this.kept) return;
  this.dropIdle(id);
  for (const burst of this.bursts) if (burst.owner === id) burst.sprites.forEach(s => s.destroy());
  this.bursts = this.bursts.filter(b => b.owner !== id);
 }
 private clearTransient() {
  this.land();
  this.owner = null; this.remaining = 0;
  this.bursts.forEach(b => b.sprites.forEach(s => s.destroy())); this.bursts = [];
  this.pool.forEach(d => d.sprite.destroy()); this.pool = [];
 }
 /**
  * Marks the owner of the final promotion. Its ignition, trail residue and standing flame
  * then survive `clear(true)` and `remove()`, so the presentation reset at the end of a
  * match cannot extinguish a fire the player has not seen yet.
  */
 keep(id: object) { this.kept = id; }
 /** Full clear unless `keepOwned`, which spares the kept owner only. */
 clear(keepOwned = false) {
  const kept = keepOwned ? this.kept : null;
  if (!kept) {
   this.clearTransient();
   this.kept = null;
  } else {
   for (const burst of this.bursts)
    if (burst.owner !== kept) for (const s of burst.sprites) s.destroy();
   this.bursts = this.bursts.filter(b => b.owner === kept);
  }
  // The trail residue of the final capture ages out on its own, like any landing.
  for (const id of [...this.idle.keys()]) if (id !== kept) this.dropIdle(id);
 }
}
