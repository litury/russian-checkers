import type { IMove, IPosition } from '@/rules';
import { apply, legalMoves } from '@/rules';

export type BotSkill = 'easy' | 'normal' | 'hard';

export const botSkillDepth: Record<BotSkill, number> = { easy: 2, normal: 4, hard: 6 };
export const botSkillBudgetMs: Record<BotSkill, number> = { easy: 50, normal: 150, hard: 400 };

const MAN = 100;
const KING = 300;

function evaluate(position: IPosition): number {
 const side = position.turn;
 let score = 0;
 for (let row = 0; row < 8; row += 1) {
  for (let col = 0; col < 8; col += 1) {
   const piece = position.squares[row][col];
   if (!piece) continue;
   const center = (3.5 - Math.abs(row - 3.5)) + (3.5 - Math.abs(col - 3.5));
   const val = (piece.kind === 'king' ? KING : MAN) + center * 4;
   score += piece.side === side ? val : -val;
  }
 }
 return score;
}

export function pickBotMove(
 position: IPosition,
 random: () => number = Math.random,
 skill: BotSkill = 'normal',
): IMove | undefined {
 const moves = legalMoves(position);
 if (moves.length === 0) return undefined;
 if (moves.length === 1) return moves[0];
 const depth = botSkillDepth[skill] ?? 4;
 const deadline = Date.now() + (botSkillBudgetMs[skill] ?? 150);
 let ranked = moves.map((move) => ({ move, score: -Infinity as number }));
 for (let d = 1; d <= depth; d += 1) {
  if (Date.now() >= deadline) break;
  const next: { move: IMove; score: number }[] = [];
  let alpha = -Infinity;
  for (const { move } of ranked) {
   if (Date.now() >= deadline) break;
   const child = apply(position, move);
   const score = child
    ? -negamax(child, d - 1, -Infinity, -alpha, deadline)
    : -Infinity;
   next.push({ move, score });
   if (score > alpha) alpha = score;
  }
  if (next.length) ranked = next.sort((a, b) => b.score - a.score);
 }
 if (skill === 'easy' && ranked.length > 1 && random() < 0.35) return ranked[1].move;
 return ranked[0].move;
}

function negamax(
 position: IPosition,
 depth: number,
 alpha: number,
 beta: number,
 deadline: number,
): number {
 if (Date.now() >= deadline || depth <= 0) return evaluate(position);
 const moves = legalMoves(position);
 if (moves.length === 0) return evaluate(position) - 50_000;
 let best = -Infinity;
 for (const move of moves) {
  if (Date.now() >= deadline) break;
  const child = apply(position, move);
  if (!child) continue;
  const score = -negamax(child, depth - 1, -beta, -alpha, deadline);
  if (score > best) best = score;
  if (score > alpha) alpha = score;
  if (alpha >= beta) break;
 }
 return best === -Infinity ? evaluate(position) : best;
}
