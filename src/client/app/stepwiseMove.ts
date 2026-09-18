import { sameSquare } from '@/client/shared/sameSquare';
import { legalMoves, type IMove, type IPosition, type ISquare } from '@/rules';
import { clonePosition, isKingRow } from '@/rules/parts/board';

/** A visual/input cursor over legal COMPLETE routes, never a new rules position. */
export class StepwiseMove {
	private routes: IMove[];
	private prefix: ISquare[] = [];
	constructor(
		private readonly origin: IPosition,
		private readonly from: ISquare,
	) {
		this.routes = legalMoves(origin).filter((move) =>
			sameSquare(move.from, from),
		);
	}
	get selected(): ISquare {
		return this.prefix.at(-1) ?? this.from;
	}
	get options(): IMove[] {
		const unique = new Map<string, IMove>();
		for (const move of this.routes) {
			const land = move.path[this.prefix.length];
			if (land)
				unique.set(`${land.row},${land.col}`, {
					from: this.selected,
					path: [land],
				});
		}
		return [...unique.values()];
	}
	/** Full visual continuations of compatible routes; never input destinations. */
	get remainingRoutes(): IMove[] {
		return this.routes.map(move => ({
			from: this.selected,
			path: move.path.slice(this.prefix.length),
		}));
	}
	get visualPosition(): IPosition {
		const next = clonePosition(this.origin);
		const piece = next.squares[this.from.row][this.from.col];
		if (!piece) return next;
		next.squares[this.from.row][this.from.col] = null;
		const kind =
			piece.kind === 'king' || this.prefix.some((s) => isKingRow(s, piece.side))
				? 'king'
				: 'man';
		next.squares[this.selected.row][this.selected.col] = { ...piece, kind };
		// Victims stay on the board. Never call legalMoves on this visual projection:
		// only the original routes know which blockers have already been captured.
		return next;
	}
	choose(land: ISquare): { hop: IMove; complete: IMove | null } | null {
		const nextHits = this.routes.filter((move) => {
			const next = move.path[this.prefix.length];
			return next && sameSquare(next, land);
		});
		if (nextHits.length) {
			const hop = { from: this.selected, path: [land] };
			this.routes = nextHits;
			this.prefix.push(land);
			return {
				hop,
				complete: nextHits.find((move) => move.path.length === this.prefix.length) ?? null,
			};
		}
		if (this.routes.length !== 1) return null;
		const move = this.routes[0]!;
		if (!move.path.slice(this.prefix.length).some((s) => sameSquare(s, land))) return null;
		const rest = move.path.slice(this.prefix.length);
		if (!rest.length) return null;
		const hop = { from: this.selected, path: rest };
		this.prefix = move.path.slice();
		return { hop, complete: move };
	}

	get clickable(): ISquare[] {
		const next = this.options.map((move) => move.path[0]).filter(Boolean) as ISquare[];
		if (this.routes.length === 1) {
			return this.routes[0]!.path.slice(this.prefix.length);
		}
		return next;
	}
}
