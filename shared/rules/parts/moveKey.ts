import type { IMove } from '../types/IMove';
import { squareKey } from './board';

export function moveKey(move: IMove): string {
	const path = move.path.map(squareKey).join('-');
	return `${squareKey(move.from)}:${path}`;
}
