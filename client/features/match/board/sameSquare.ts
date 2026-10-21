import type { ISquare } from '@/shared/rules';

export function sameSquare(a: ISquare, b: ISquare): boolean {
	return a.row === b.row && a.col === b.col;
}
