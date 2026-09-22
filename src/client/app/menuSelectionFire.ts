/** Menu-only sheet: eight registered frames, straight alpha, no board dependencies. */
export const MENU_FIRE = { frames: 8, columns: 4, cell: 256, loopMs: 1600, ignitionMs: 360 } as const;
export function menuFireFrame(elapsed: number, reduced: boolean): number {
 return reduced ? 0 : Math.floor(Math.max(0, elapsed) / (MENU_FIRE.loopMs / MENU_FIRE.frames)) % MENU_FIRE.frames;
}
/** Cross-fading adjacent registered frames avoids a brightness jump at the loop seam. */
export function drawMenuFire(context: CanvasRenderingContext2D, sheet: HTMLImageElement, elapsed: number, burst: number, reduced: boolean) {
 const index = menuFireFrame(elapsed, reduced);
 const blend = reduced ? 0 : (elapsed % (MENU_FIRE.loopMs / MENU_FIRE.frames)) / (MENU_FIRE.loopMs / MENU_FIRE.frames);
 const ignition = reduced ? 0 : Math.sin(Math.PI * Math.max(0, burst) / MENU_FIRE.ignitionMs);
 context.save();
 context.globalCompositeOperation = 'lighter';
 for (const [frame, alpha] of [[index, 1 - blend], [(index + 1) % MENU_FIRE.frames, blend]]) {
  if (!alpha) continue;
  context.globalAlpha = alpha * .8;
  // Fixed menu anchor. Rear tips peek above the rim; the checker occludes the center.
  context.drawImage(sheet, (frame % 4) * 256, Math.floor(frame / 4) * 256, 256, 256, -15, -250 - ignition * 24, 760, 660);
  if (ignition > 0) {
   context.globalAlpha = alpha * ignition * .65;
   // Short ignition at the foot, under the checker rather than over its face.
   context.drawImage(sheet, (frame % 4) * 256, Math.floor(frame / 4) * 256, 256, 256, -15, 375, 760, 360);
  }
 }
 context.restore();
}
