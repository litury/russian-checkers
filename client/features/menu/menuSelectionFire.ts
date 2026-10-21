/** Menu-only existing sheet: eight registered frames, straight alpha. */
export const MENU_FIRE = { frames: 8, columns: 4, cell: 256, loopMs: 1600, ignitionMs: 360, sidePadding: 64, canvasWidth: 852, topPadding: 256, canvasHeight: 980 } as const;
export function menuFireFrame(elapsed: number, reduced: boolean): number {
 return reduced ? 0 : Math.floor(Math.max(0, elapsed) / (MENU_FIRE.loopMs / MENU_FIRE.frames)) % MENU_FIRE.frames;
}
/** Three differently timed streams; the body masks their bases, not their tips.
 * Source crop excludes the sheet's empty upper half. No extra assets or particles.
 * Front is only a broken, low heat seam below the face, never a full halo.
 */
export function drawMenuFire(context: CanvasRenderingContext2D, sheet: HTMLImageElement, elapsed: number, burst: number, reduced: boolean, layer: 'rear' | 'front' = 'rear') {
 const time = reduced ? 0 : Math.max(0, elapsed);
 const ignition = reduced ? 0 : Math.sin(Math.PI * Math.min(MENU_FIRE.ignitionMs, Math.max(0, burst)) / MENU_FIRE.ignitionMs);
 const streams = layer === 'rear' ? [
  { sx: 10, sw: 236, x: -28, y: -290, w: 780, h: 630, period: 1180, phase: 0, lift: 32 },
  { sx: 14, sw: 68, x: -32, y: 82, w: 196, h: 470, period: 790, phase: 370, lift: 48 },
  { sx: 180, sw: 66, x: 562, y: 44, w: 196, h: 490, period: 1430, phase: 830, lift: 38 },
 ] : [{ sx: 22, sw: 212, x: 120, y: 632, w: 488, h: 40, period: 1180, phase: 210, lift: 0 }];
 context.save();
 context.globalCompositeOperation = 'source-over';
 if (layer === 'front') {
  context.beginPath();
  context.moveTo(120, 624); context.quadraticCurveTo(365, 717, 610, 624);
  context.lineTo(602, 647); context.quadraticCurveTo(365, 715, 128, 647);
  context.closePath(); context.clip();
 }
 for (const stream of streams) {
  const clock = reduced ? 0 : time * MENU_FIRE.loopMs / stream.period + stream.phase;
  const index = menuFireFrame(clock, reduced);
  const blend = reduced ? 0 : (clock % 200) / 200;
  const rise = reduced ? 0 : stream.lift * (.5 + .5 * Math.sin(time / stream.period * Math.PI * 2 + stream.phase));
  for (const [frame, alpha] of [[index, 1 - blend], [(index + 1) % MENU_FIRE.frames, blend]]) {
   if (!alpha) continue;
   context.globalAlpha = alpha * (layer === 'front' ? .82 : .96);
   context.drawImage(sheet, (frame % 4) * 256 + stream.sx, Math.floor(frame / 4) * 256 + 90, stream.sw, 142,
    stream.x, stream.y - rise - ignition * stream.lift, stream.w, stream.h + rise + ignition * stream.lift);
  }
 }
 context.restore();
}
