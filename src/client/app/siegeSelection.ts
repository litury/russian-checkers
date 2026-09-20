import { SelectionMotion } from '../modules/board/selectionMotion';
import { selectionV2Frame } from '../modules/board/selectionV2';

export type SiegeSide = 'white' | 'black';
/** Shared board motion/rounding, independent of asset loading and Phaser readiness. */
export class SiegeSelection {
 readonly pieces = { white: new SelectionMotion(), black: new SelectionMotion() };
 side: SiegeSide;
 constructor(side: SiegeSide) {
  this.side = side;
  this.select(side, true);
 }
 select(side: SiegeSide, reduced: boolean) {
  this.side = side;
  for (const color of ['white', 'black'] as const) this.pieces[color].select(color === side, reduced);
 }
 advance(delta: number, reduced: boolean) {
  for (const piece of Object.values(this.pieces)) piece.advance(delta, reduced);
 }
 displacement(side: SiegeSide) { return selectionV2Frame(this.pieces[side].progress); }
 get settled() { return this.pieces[this.side].progress === 1 && this.pieces[this.side === 'white' ? 'black' : 'white'].progress === 0; }
}
export function siegeSide(root: HTMLElement): SiegeSide {
 return root.querySelector('.gate-piece-black')?.getAttribute('aria-pressed') === 'true' ? 'black' : 'white';
}
export function setSiegeSide(root: HTMLElement, side: SiegeSide) {
 for (const button of root.querySelectorAll<HTMLButtonElement>('.gate-piece-slot')) {
  const selected = button.dataset.side === side;
  button.classList.toggle('is-chosen', selected);
  button.setAttribute('aria-pressed', String(selected));
 }
 root.dispatchEvent(new CustomEvent('siege-side', { detail: side }));
}
