import type { IPosition, ISquare } from '@/rules';

export interface IBoardView {
	sync: (
		position: IPosition,
		highlights: ISquare[],
		selected: ISquare | null,
	) => void;
	layout: (width: number, height: number) => void;
}
