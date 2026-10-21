import { pieceSelectSfx } from '@/client/audio/pieceSfx';
import { uiSfx } from '@/client/audio/uiSfx';
import { haptics, moveHapticKinds } from '@/client/platform/browser/haptics';
import { markPerf } from '@/client/platform/browser/perfMarks';
import type { IMove, ISquare, Side } from '@/shared/rules';
import { legalMoves, winner } from '@/shared/rules';
import type { IBoardView } from './board/IBoardView';
import { sameSquare } from './board/sameSquare';
import type { BotTurn } from './bot/botTurn';
import type { BotSkill } from './bot/pickBotMove';
import { canUndoBot } from './botUndo';
import type { MatchClock } from './matchClock';
import type { MatchSession } from './matchSession';
import type { OnlineMatchCoordinator } from './online/onlineMatchCoordinator';
import { StepwiseMove } from './stepwiseMove';

interface MatchView {
	board(): IBoardView | undefined;
	now(): number;
	hideResult(): void;
	turnHandoff(): void;
	refresh(): void;
	paintActions(): void;
	canSelect(): boolean;
	remaining(side: Side): number;
	flag(): void;
	end(side: Side | 'draw', kind?: string): void;
	presentResult(): void;
	botSkill(): BotSkill;
	autoMove(): boolean;
}
export class MatchInteraction {
	constructor(
		private session: MatchSession,
		private clock: MatchClock,
		private bot: BotTurn,
		private network: OnlineMatchCoordinator,
		private ui: MatchView,
	) {}
	maybeAutoMove(): void {
		if (this.session.preview) return;
		if (this.session.restoringBotUndo) return;
		if (!this.ui.canSelect()) {
			return;
		}
		if (!this.ui.autoMove()) {
			return;
		}
		// A shared next square does not make multiple complete routes forced.
		if (this.session.humanChain) return;
		const moves = legalMoves(this.session.position);
		if (moves.length === 1) {
			this.playHuman(moves[0]);
		}
	}

	optionMoves(): IMove[] {
		if (!this.ui.canSelect()) {
			return [];
		}
		// Visual routes stay complete; humanHighlights/choose expose only the next hop.
		if (this.session.humanChain) return this.session.humanChain.remainingRoutes;
		return this.session.selected
			? new StepwiseMove(this.session.position, this.session.selected)
					.remainingRoutes
			: [];
	}

	humanHighlights(): ISquare[] {
		if (!this.ui.canSelect()) {
			return [];
		}
		const moves = legalMoves(this.session.position);
		const selected = this.session.selected;
		if (selected) {
			const chain =
				this.session.humanChain ??
				new StepwiseMove(this.session.position, selected);
			return uniqueSquares(chain.clickable);
		}
		return uniqueSquares(moves.map((move) => move.from));
	}

	onSquare(square: ISquare): void {
		if (
			this.session.paused ||
			this.session.moving ||
			this.session.flagLock ||
			this.session.countingIn ||
			this.session.phase === 'over' ||
			(this.session.online && !this.network.onlineBegun) ||
			!this.ui.canSelect()
		) {
			return;
		}
		const moves = legalMoves(this.session.position);
		const selected = this.session.selected;
		if (selected) {
			if (this.playHumanHop(square)) {
				return;
			}
		}
		// A started capture is irrevocable, including clicks on other own pieces.
		if (this.session.humanChain) return;
		if (moves.some((move) => sameSquare(move.from, square))) {
			if (selected && sameSquare(selected, square)) return;
			if (!selected || !sameSquare(selected, square)) haptics.play('tick');
			this.session.selected = square;
			this.ui.refresh();
			pieceSelectSfx(
				this.session.position.squares[square.row][square.col]?.side ?? 'black',
			);
			return;
		}
		const piece = this.session.position.squares[square.row][square.col];
		const denied = Boolean(piece && piece.side === this.session.position.turn);
		this.session.selected = null;
		this.ui.refresh();
		if (denied) {
			this.ui.board()?.deny(square);
		}
	}

	cancelSelection(): void {
		if (
			this.session.phase !== 'human' ||
			this.session.paused ||
			this.session.moving ||
			this.session.countingIn ||
			this.session.humanChain
		)
			return;
		this.session.selected = null;
		this.ui.refresh();
	}

	playHumanHop(square: ISquare): boolean {
		if (!this.session.selected) return false;
		if (
			this.session.online &&
			this.ui.remaining(this.session.position.turn) <= 0
		) {
			this.ui.flag();
			return false;
		}
		const chain =
			this.session.humanChain ??
			new StepwiseMove(this.session.position, this.session.selected);

		const beforeHop = chain.visualPosition;
		const chosen = chain.choose(square);
		if (!chosen) return false;
		const kinds = moveHapticKinds(beforeHop, chosen.hop);
		const actions = kinds.map(() => ({}));
		let landing = 0;
		if (!this.session.humanChain) this.session.saveUndo(this.clock.banks);
		this.ui.paintActions();
		this.session.humanChain = chain;
		this.session.moving = true;

		const undoGen = this.session.online ? null : this.session.botUndoGen;
		const matchGen = this.session.resultGen;
		this.ui.board()?.playMove(
			chosen.hop,
			() => {
				if (matchGen !== this.session.resultGen) return;
				if (undoGen !== null && undoGen !== this.session.botUndoGen) return;
				this.session.moving = false;
				if (this.session.acceptedResult) {
					this.session.humanChain = null;
					this.network.drainInbound();
					return;
				}
				this.session.selected = chain.selected;
				// Time runs through hops and branch decisions; a final tap cannot rescue a flag.
				if (this.ui.remaining(this.session.position.turn) <= 0) {
					this.ui.flag();
					return;
				}
				if (chosen.complete) {
					if (this.session.online) {
						const kind = kinds.at(-1);
						if (kind)
							this.session.pendingHaptic = {
								move: chosen.complete,
								kind,
								ply: this.network.lastPly + 1,
							};
						this.network.live?.move(chosen.complete);
						this.network.drainInbound();
					} else this.completeHumanMove(chosen.complete);
				} else this.ui.refresh();
			},
			() => {
				const index = landing++;
				if (
					matchGen !== this.session.resultGen ||
					(undoGen !== null && undoGen !== this.session.botUndoGen) ||
					this.session.acceptedResult ||
					this.ui.remaining(this.session.position.turn) <= 0
				)
					return;
				// The final online landing waits for the authoritative matching ply.
				if (
					this.session.online &&
					chosen.complete &&
					index === kinds.length - 1
				)
					return;
				if (kinds[index]) haptics.play(kinds[index], actions[index]);
			},
			undefined,
			true,
		);
		return true;
	}

	animateMove(move: IMove, after: () => void): void {
		this.session.moving = true;
		this.session.selected = null;

		const undoGen = this.session.online ? null : this.session.botUndoGen;
		const matchGen = this.session.resultGen;
		this.ui.board()?.playMove(move, () => {
			if (matchGen !== this.session.resultGen) return;
			if (undoGen !== null && undoGen !== this.session.botUndoGen) return;
			this.session.moving = false;
			after();
			this.network.drainInbound();
		});
	}

	undoBot(): void {
		if (this.session.online || this.session.phase === 'over') return;
		if (!canUndoBot(this.session.online, this.session.botUndoStack.length))
			return;
		const clocks = this.session.restoreUndo();
		if (!clocks) return;
		this.session.botUndoGen += 1;
		this.bot.cancel();

		this.bot.pending = false;
		this.ui.board()?.reset();
		this.session.moving = false;
		this.clock.banks = clocks;
		this.session.selected = null;
		this.session.humanChain = null;
		this.session.flagLock = false;
		this.session.resultGen += 1;
		this.ui.hideResult();
		this.session.phase =
			this.session.position.turn === this.session.humanSide ? 'human' : 'bot';
		this.clock.startedAt = this.ui.now();
		this.session.restoringBotUndo = true;
		try {
			this.ui.refresh();
		} finally {
			this.session.restoringBotUndo = false;
		}
		uiSfx('undo-applied');
	}

	playHuman(move: IMove): void {
		this.session.saveUndo(this.clock.banks);
		this.ui.paintActions();
		this.animateMove(move, () => {
			if (this.session.online) {
				if (!this.session.acceptedResult) this.network.live?.move(move);
				else this.network.drainInbound();
			} else this.completeHumanMove(move);
		});
	}

	completeHumanMove(move: IMove): void {
		const mover = this.session.position.turn;
		if (!this.session.commit(move)) return;
		const pending = this.session.pendingHaptic;
		this.session.pendingHaptic = null;
		if (
			this.session.online &&
			pending &&
			this.network.lastPly === pending.ply &&
			mover === this.session.humanSide &&
			sameSquare(pending.move.from, move.from) &&
			pending.move.path.length === move.path.length &&
			pending.move.path.every((square, index) =>
				sameSquare(square, move.path[index]),
			)
		) {
			haptics.play(pending.kind, pending);
		}
		if (!this.session.acceptedResult)
			this.clock.settle(mover, this.ui.now(), this.session.paused);
		// First accepted move of the human side: bots may have played earlier plies.
		// markPerf keeps the first write, so later human moves never move the mark.
		if (mover === this.session.humanSide) markPerf('first-move-played');

		this.session.humanChain = null;
		this.session.selected = null;
		this.ui.board()?.notePly();

		if (this.session.acceptedResult) {
			this.network.applyingNet = false;
			this.network.drainInbound();
			return;
		}
		const outcome = this.session.outcome();
		if (!this.session.online && outcome === 'draw') {
			this.ui.end('draw');
			return;
		}
		if (!this.session.online && outcome) {
			this.ui.end(outcome);
			return;
		}
		this.session.phase = this.session.online
			? this.network.isHumanTurn()
				? 'human'
				: 'bot'
			: this.session.position.turn === this.session.humanSide
				? 'human'
				: 'bot';
		if (!this.session.paused && !this.clock.remotePaused) this.ui.turnHandoff();
		this.ui.refresh();
		if (this.session.online) {
			if (!this.network.applyingNet && mover === this.session.humanSide)
				this.network.lastPly += 1;
			this.network.applyingNet = false;
			this.network.drainInbound();
			return;
		}
		this.bot.cancel();
		const undoGen = this.session.botUndoGen;
		this.bot.schedule(() => {
			if (undoGen === this.session.botUndoGen) this.playBot();
		});
	}

	playRemote(move: IMove): void {
		this.animateMove(move, () => this.completeHumanMove(move));
	}

	playHumanLocal(move: IMove): void {
		this.completeHumanMove(move);
	}

	playBot(): void {
		if (this.session.online) return;
		if (this.session.paused) {
			this.bot.pending = true;
			return;
		}
		if (this.session.phase !== 'bot' || this.session.moving) {
			return;
		}
		this.bot.pending = false;
		const move = this.bot.choose(this.session.position, this.ui.botSkill());
		if (!move) {
			this.ui.end(winner(this.session.position) ?? 'white');
			return;
		}
		this.animateMove(move, () => {
			const mover = this.session.position.turn;
			if (!this.session.commit(move)) {
				this.ui.end(winner(this.session.position) ?? 'white');
				return;
			}
			if (!this.session.acceptedResult)
				this.clock.settle(mover, this.ui.now(), this.session.paused);

			if (this.session.acceptedResult) {
				this.ui.presentResult();
				return;
			}
			const outcome = this.session.outcome();
			if (outcome === 'draw') {
				this.ui.end('draw');
				return;
			}
			if (outcome) {
				this.ui.end(outcome);
				return;
			}
			this.session.phase = 'human';
			if (!this.session.paused) this.ui.turnHandoff();
			this.ui.refresh();
		});
	}

	resignMatch(): void {
		if (
			this.session.phase === 'title' ||
			this.session.phase === 'over' ||
			this.session.flagLock
		)
			return;
		if (this.session.online) {
			this.network.live?.resign();
			return;
		}
		if (this.session.paused || !this.ui.board()) return;
		this.ui.end(
			this.session.humanSide === 'white' ? 'black' : 'white',
			'resign',
		);
	}
}
function uniqueSquares(squares: ISquare[]): ISquare[] {
	const seen = new Set<string>();
	const unique: ISquare[] = [];
	for (const square of squares) {
		const key = `${square.row},${square.col}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		unique.push(square);
	}
	return unique;
}
