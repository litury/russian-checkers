/** Finite, reversible artwork progress; no delayed callbacks can outlive a piece. */
export class SelectionMotion {
 progress = 0;
 private target = 0;
 private start = 0;
 private elapsed = 0;
 private duration = 0;
 get frame(): number { return Math.round(this.progress * 20); }
 /** Ladder direction for the overlay pack: true while the selection opens. */
 get opening(): boolean { return this.target >= this.start; }
 select(open: boolean, reduced: boolean): void {
  const target = open ? 1 : 0;
  if (target !== this.target) {
   this.start = this.progress;
   this.target = target;
   this.elapsed = 0;
   this.duration = 650 * Math.abs(target - this.start);
  }
  if (reduced) { this.progress = this.target; this.elapsed = this.duration; }
 }
 advance(delta: number, reduced: boolean): void {
  if (reduced || !this.duration) { this.progress = this.target; this.elapsed = this.duration; return; }
  this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, delta));
  const p = this.elapsed / this.duration;
  this.progress = this.start + (this.target - this.start) * p * p * (3 - 2 * p);
 }
}
