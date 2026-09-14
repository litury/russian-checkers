import { legalMoves, type IMove, type IPosition, type ISquare, type Side } from '@/rules';
import { sameSquare } from '@/client/shared/sameSquare';
/** Persistent availability; callers supply original legal routes during capture chains. */
export class OpeningMoveHint {
 private squares: ISquare[] = [];
 start(position: IPosition, local: Side) {
  this.update(position.turn === local ? legalMoves(position) : []);
 }
 update(moves: IMove[]) {
  this.squares = [...new Map(moves.filter(m => m.path.length).map(m => [`${m.from.row},${m.from.col}`, m.from])).values()]
   .sort((a,b) => a.col-b.col || a.row-b.row);
 }
 clear() { this.squares = []; }
 sample(progress: number, reduced: boolean, selected: ISquare | null = null) {
  return this.squares.map((square,i) => {
   const delay = this.squares.length > 1 ? i/(this.squares.length-1)*.55 : 0;
   const t = reduced ? 1 : Math.max(0,Math.min(1,(progress-delay)/.35));
   return {square, alpha:t*t*(3-2*t)};
  }).filter(({square}) => !selected || !sameSquare(square, selected));
 }
}
