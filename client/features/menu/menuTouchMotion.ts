/** Rigid travel in source-art pixels. Only the moving disk uses this offset. */
export class MenuTouchMotion {
 offset = 0;
 held = false;
 press() { this.held = true; this.offset = 34; }
 release(reduced = false) { this.held = false; if (reduced) this.offset = 0; }
 advance(delta: number, reduced: boolean) {
  if (!this.held) this.offset = reduced ? 0 : Math.max(0, this.offset - delta * 34 / 180);
 }
 get moving() { return !this.held && this.offset > 0; }
}
