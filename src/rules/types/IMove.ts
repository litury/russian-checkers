import type { ISquare } from './ISquare';

export interface IMove {
	from: ISquare;
	path: ISquare[];
}
