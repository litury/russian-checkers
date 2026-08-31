import type { IMove, IPosition } from '@/rules';
import { legalMoves } from '@/rules';
import { pickUniform } from './parts/pickUniform';

export function pickBotMove(
	position: IPosition,
	random: () => number = Math.random,
): IMove | undefined {
	return pickUniform(legalMoves(position), random);
}
