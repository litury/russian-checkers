import type { Side } from '../types/Side';

export function oppositeSide(side: Side): Side {
	return side === 'white' ? 'black' : 'white';
}
