import type { IMove, IPosition, ISquare } from '@/rules';

export interface IBoardView {
	sync: (
		position: IPosition,
		highlights: ISquare[],
		selected: ISquare | null,
	) => void;
	layout: (width: number, height: number) => void;
	press: (square: ISquare) => void;
	playMove: (
		move: IMove,
		onDone: () => void,
		onLand?: (took: boolean) => void,
	) => void;
}
