import { clonePosition, setPiece } from './parts/board';
import type { IPosition } from './types/IPosition';
import type { ISquare } from './types/ISquare';
import type { Side } from './types/Side';

export const blitzStartMs = 60_000;
export const blitzHoldMs = 3_000;
export const countdownBeats = ['3', '2', '1', 'ГО'] as const;
export const countdownBeatMs = 700;

export function ownPieceSquares(position: IPosition, side: Side): ISquare[] {
	const out: ISquare[] = [];
	for (let row = 0; row < position.squares.length; row += 1) {
		const line = position.squares[row];
		if (!line) {
			continue;
		}
		for (let col = 0; col < line.length; col += 1) {
			const piece = line[col];
			if (piece?.side === side) {
				out.push({ row, col });
			}
		}
	}
	return out;
}

export function explodeFlag(
	position: IPosition,
	random: () => number = Math.random,
): { next: IPosition; victim: ISquare | null } {
	const pieces = ownPieceSquares(position, position.turn);
	if (pieces.length === 0) {
		return { next: position, victim: null };
	}
	const index = Math.min(
		pieces.length - 1,
		Math.max(0, Math.floor(random() * pieces.length)),
	);
	const victim = pieces[index];
	if (!victim) {
		return { next: position, victim: null };
	}
	const next = clonePosition(position);
	setPiece(next, victim, null);
	return { next, victim };
}

export function remainingMs(
	bankMs: number,
	startedAt: number,
	now: number,
	paused: boolean,
	holdMs: number = blitzHoldMs,
): number {
	if (paused) {
		return Math.max(0, bankMs);
	}
	const elapsed = now - startedAt;
	if (elapsed <= holdMs) {
		return Math.max(0, bankMs);
	}
	return Math.max(0, bankMs - (elapsed - holdMs));
}

export function afterMoveBank(bankMs: number): number {
	return Math.max(0, bankMs);
}

export function afterFlagBank(): number {
	return 0;
}
