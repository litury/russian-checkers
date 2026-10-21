import type { PieceKind } from './PieceKind';
import type { Side } from './Side';

export interface IPiece {
	side: Side;
	kind: PieceKind;
}
