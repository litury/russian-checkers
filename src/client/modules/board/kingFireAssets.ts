import type Phaser from 'phaser';

/** Plan B approved in t_91747d53: reuse the QA-accepted generated master.
 * Lossless delivery copy; all decoded RGBA pixels and alpha match the source.
 * Source provenance: ui/siege/menu-selection-fire.json. Native frames are 256².
 */
const master = new URL('./king-fire-generated.webp', import.meta.url).href;
export const KING_FIRE_FRAMES = 8;
export const kingFireAssets = {
 'idle-back': master, 'idle-front': master,
 'ignite-back': master, 'ignite-front': master, trail: master, static: master,
};
export function kingFireTextureReady(scene: Phaser.Scene, name: string): boolean {
 const key = `king-fire_${name}`;
 // Legacy unit harnesses have no TextureManager; never taken by the live scene.
 if (typeof scene.textures?.exists !== 'function') return true;
 if (!scene.textures.exists(key)) return false;
 const texture = scene.textures.get(key);
 return texture.frameTotal === KING_FIRE_FRAMES + 1;
}
export function preloadKingFire(scene: Phaser.Scene): void {
 const failed = (file: { key?: string }) => {
  if (file.key?.startsWith('king-fire_'))
   console.error('[king-fire] sheet load failed', file.key);
 };
 scene.load.on('loaderror', failed);
 scene.load.once('complete', () => {
  scene.load.off('loaderror', failed);
  for (const name of Object.keys(kingFireAssets))
   if (!kingFireTextureReady(scene, name))
    console.error('[king-fire] missing or incomplete sheet', `king-fire_${name}`, `expected ${KING_FIRE_FRAMES} frames`);
 });
 for (const [name, url] of Object.entries(kingFireAssets))
  scene.load.spritesheet(`king-fire_${name}`, url, { frameWidth: 256, frameHeight: 256, endFrame: 7 });
}
