import type { IPiece, IPosition, PieceKind, Side } from '@/shared/rules';
import type { TimeControlId } from '@/shared/rules/timeControl';

export const READY_MS = 25_000;

export type BoardPiece = {row: number; col: number; side: Side; kind: PieceKind};

export type ClockSnap = {
	banks: {white: number; black: number};
	turnStarted: number;
	paused: boolean;
	serverNow: number;
	dropUntil?: number;
	timeControl?: TimeControlId;
};

export type MatchSnapshot = {
	matchId: string;
	ply: number;
	turn: Side;
	hash: string;
	begun: boolean;
	pieces: BoardPiece[];
	clocks?: ClockSnap;
	drawCounters?: IPosition['drawCounters'];
	drawOffer?: Side | null;
	lastDrawOffer?: Side | null;
};

export function encodePieces(position: IPosition): BoardPiece[] {
	const pieces: BoardPiece[] = [];
	for (let row = 0; row < 8; row++) {
		for (let col = 0; col < 8; col++) {
			const piece = position.squares[row]?.[col];
			if (piece) pieces.push({row, col, side: piece.side, kind: piece.kind});
		}
	}
	return pieces;
}

export function hashPosition(position: IPosition): string {
	return `${position.turn}|${encodePieces(position)
		.map((p) => `${p.row}${p.col}${p.side[0]}${p.kind[0]}`)
		.join(',')}`;
}

export function snapshotOf(matchId: string, position: IPosition, ply: number, begun: boolean, clocks?: ClockSnap): MatchSnapshot {
	const pieces = encodePieces(position);
	return {matchId, ply, turn: position.turn, hash: hashPosition(position), begun, pieces, ...(clocks ? {clocks} : {}), ...(position.drawCounters ? {drawCounters: position.drawCounters} : {})};
}

export function positionFromSnapshot(snap: Pick<MatchSnapshot, 'pieces' | 'turn' | 'drawCounters'>): IPosition {
	const squares: (IPiece | null)[][] = Array.from({length: 8}, () => Array.from({length: 8}, () => null));
	for (const p of snap.pieces) {
		squares[p.row][p.col] = {side: p.side, kind: p.kind};
	}
	return {squares, turn: snap.turn, ...(snap.drawCounters ? {drawCounters: structuredClone(snap.drawCounters)} : {})};
}

export function classifyPly(lastPly: number, incomingPly: number): 'apply' | 'gap' | 'stale' {
	if (incomingPly === lastPly + 1) return 'apply';
	if (incomingPly <= lastPly) return 'stale';
	return 'gap';
}

export function takeNextPly<T extends {ply: number}>(buffer: T[], lastPly: number): T | undefined {
	const i = buffer.findIndex((m) => m.ply === lastPly + 1);
	if (i < 0) return undefined;
	return buffer.splice(i, 1)[0];
}

export function bothReady(ready: Set<string>, white: string, black: string): boolean {
	return ready.has(white) && ready.has(black);
}
