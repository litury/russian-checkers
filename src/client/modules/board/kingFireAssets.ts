import type Phaser from 'phaser';

export const kingFireAssets = {
 'idle-back': new URL('./king-fire-polish/idle-back.webp', import.meta.url).href,
 'idle-front': new URL('./king-fire-polish/idle-front.webp', import.meta.url).href,
 'ignite-back': new URL('./king-fire-polish/ignite-back.webp', import.meta.url).href,
 'ignite-front': new URL('./king-fire-polish/ignite-front.webp', import.meta.url).href,
 trail: new URL('./king-fire/trail.webp', import.meta.url).href,
 static: new URL('./king-fire/static.webp', import.meta.url).href,
};
export function preloadKingFire(scene: Phaser.Scene): void {
 for (const [name, url] of Object.entries(kingFireAssets))
  scene.load.spritesheet(`king-fire_${name}`, url, { frameWidth: 64, frameHeight: 80 });
}
