import type Phaser from 'phaser';

export const kingFireAssets = {
 'idle-back': new URL('./king-fire-polish/idle-back.png', import.meta.url).href,
 'idle-front': new URL('./king-fire-polish/idle-front.png', import.meta.url).href,
 'ignite-back': new URL('./king-fire-polish/ignite-back.png', import.meta.url).href,
 'ignite-front': new URL('./king-fire-polish/ignite-front.png', import.meta.url).href,
 trail: new URL('./king-fire/trail.png', import.meta.url).href,
 static: new URL('./king-fire/static.png', import.meta.url).href,
};
export function preloadKingFire(scene: Phaser.Scene): void {
 for (const [name, url] of Object.entries(kingFireAssets))
  scene.load.spritesheet(`king-fire_${name}`, url, { frameWidth: 64, frameHeight: 80 });
}
