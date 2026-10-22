import { markPerf } from '@/client/platform/browser/perfMarks';
import { probeApi } from '@/client/platform/network/cloud';
import { type NetMove, openLive } from '@/client/platform/network/live';
import {
	classifyPly,
	type MatchSnapshot,
	positionFromSnapshot,
	takeNextPly,
} from '@/shared/protocol/matchState';
import type { IMove, Side } from '@/shared/rules';
import type { MatchClock } from '../matchClock';
import type { MatchSession } from '../matchSession';
import {
	FOUND_HOLD_MS,
	SEARCH_TIMEOUT_MS,
	type SearchPhase,
} from './matchmakingSearch';

interface TimerHandle {
	remove(dispatch?: boolean): void;
}
interface OnlineView {
	now(): number;
	delay(delay: number, callback: () => void): TimerHandle;
	repeat(options: {
		delay: number;
		loop: boolean;
		callback: () => void;
	}): TimerHandle;
	search(phase: SearchPhase, seconds: number, join: string): void;
	clearSearch(): void;
	humanSide(): Side;
	start(): Promise<void>;
	refresh(): void;
	paintClock(): void;
	stopCountdown(): void;
	finishOpening(): void;
	end(side: Side | 'draw', reason: string): void;
	presentResult(): void;
	playHumanLocal(move: IMove): void;
	playRemote(move: IMove): void;
}
export class OnlineMatchCoordinator {
	live: ReturnType<typeof openLive> | null = null;
	searchPhase: SearchPhase = 'idle';
	friendJoin = '';
	searchStartedAt = 0;
	private searchOfferAt = 0;
	searchTimer?: TimerHandle;
	foundHold?: TimerHandle;
	lastPly = 0;
	serverTurn: Side = 'white';
	onlineBegun = false;
	inboundNet: NetMove[] = [];
	applyingNet = false;
	dropUntil = 0;
	dropServerNow = 0;
	dropReceivedAt = 0;
	private generation = 0;
	private disposed = false;
	constructor(
		private session: MatchSession,
		private clock: MatchClock,
		private ui: OnlineView,
	) {}
	paintSearch(): void {
		const seconds = Math.max(
			0,
			Math.floor((this.ui.now() - this.searchStartedAt) / 1000),
		);
		this.ui.search(this.searchPhase, seconds, this.friendJoin);
	}

	stopSearchTicker(): void {
		this.searchTimer?.remove(false);
		this.searchTimer = undefined;
		this.foundHold?.remove(false);
		this.foundHold = undefined;
	}

	beginSearchUi(phase: SearchPhase = 'searching'): void {
		this.searchPhase = phase;
		this.searchStartedAt = this.ui.now();
		this.searchOfferAt = this.searchStartedAt + SEARCH_TIMEOUT_MS;
		this.paintSearch();
		this.searchTimer?.remove(false);
		this.searchTimer = this.ui.repeat({
			delay: 250,
			loop: true,
			callback: () => {
				if (
					this.searchPhase !== 'searching' &&
					this.searchPhase !== 'waiting' &&
					this.searchPhase !== 'timeout-offer'
				)
					return;
				if (
					this.searchPhase !== 'timeout-offer' &&
					this.ui.now() >= this.searchOfferAt
				) {
					this.searchPhase = 'timeout-offer';
				}
				this.paintSearch();
			},
		});
	}

	cancelSearch(): void {
		this.generation++;
		this.live?.leave();
		this.live?.close();
		this.live = null;
		this.searchPhase = 'idle';
		this.friendJoin = '';
		this.stopSearchTicker();
		this.ui.clearSearch();
		window.checkersStartup.unlock();
	}

	markSearchOffline(): void {
		this.generation++;
		this.searchPhase = 'offline';
		this.stopSearchTicker();
		this.paintSearch();
		this.live?.close();
		this.live = null;
		// Keep the failure and retry/exit actions visible until the user acts.
	}

	async seatResume(): Promise<void> {
		if (this.disposed) return;
		const generation = ++this.generation;
		if (this.session.phase !== 'title') return;
		if (new URLSearchParams(location.search).get('join')) return;
		this.live?.close();
		this.live = openLive({
			onStart: (color, _matchId, snap) => {
				if (this.disposed || generation !== this.generation) return;
				if (this.session.phase !== 'title') {
					this.applyResume(color, snap);
					return;
				}
				if (!snap.begun && !snap.pieces.length && snap.ply < 1) return;
				this.session.online = true;
				this.session.humanSide = color;
				this.lastPly = snap.ply;
				this.serverTurn = snap.turn;
				this.onlineBegun = snap.begun || snap.ply > 0;
				if (snap.pieces.length)
					this.session.position = positionFromSnapshot(snap);
				this.ui.clearSearch();
				void this.ui.start();
			},
			onBegin: (snap) => this.applyBegin(snap),
			onState: (snap) => this.applyState(snap),
			onMove: (move) => {
				if (this.session.phase === 'over') return;
				this.inboundNet.push(move);
				this.drainInbound();
			},
			onEnd: (winner, reason, youWin) => {
				if (this.session.phase === 'over') return;
				const side =
					winner === 'draw'
						? 'draw'
						: youWin === true
							? this.session.humanSide
							: youWin === false
								? this.session.humanSide === 'white'
									? 'black'
									: 'white'
								: winner;
				this.ui.end(side, reason);
			},
		});
		await this.live.connect();
	}

	async requestOnline(
		kind: 'queue' | 'host' | 'join' = 'queue',
		matchId = '',
	): Promise<void> {
		if (this.disposed) return;
		const generation = ++this.generation;
		this.beginSearchUi(
			kind === 'queue'
				? 'searching'
				: kind === 'host'
					? 'friend-wait'
					: 'friend-joining',
		);
		const healthy = await probeApi();
		if (this.disposed || generation !== this.generation) return;
		if (!healthy) {
			this.markSearchOffline();
			return;
		}
		this.live?.close();
		this.live = openLive({
			onQueued: () => {
				if (this.disposed || generation !== this.generation) return;
				if (this.searchPhase === 'timeout-offer') return;
				this.searchPhase = 'waiting';
				this.paintSearch();
			},
			onHosted: (_id, code) => {
				if (this.disposed || generation !== this.generation) return;
				this.friendJoin = code && /^\d{6}$/.test(code) ? code : '';
				this.searchPhase = 'friend-wait';
				this.paintSearch();
			},
			onStart: (color, _matchId, snap) => {
				if (this.disposed || generation !== this.generation) return;
				if (this.session.phase !== 'title') {
					this.applyResume(color, snap);
					return;
				}
				this.searchPhase = 'found';
				this.stopSearchTicker();
				this.paintSearch();
				this.session.online = true;
				this.session.humanSide = color;
				this.lastPly = snap.ply;
				this.serverTurn = snap.turn;
				this.onlineBegun = snap.begun;
				if (snap.pieces.length)
					this.session.position = positionFromSnapshot(snap);
				if (snap.begun && this.session.phase === 'title') {
					this.ui.clearSearch();
					void this.ui.start();
					return;
				}
				this.foundHold = this.ui.delay(FOUND_HOLD_MS, () => {
					this.ui.clearSearch();
					void this.ui.start();
				});
			},
			onBegin: (snap) => this.applyBegin(snap),
			onState: (snap) => this.applyState(snap),
			onMove: (move) => {
				if (this.session.phase === 'over') return;
				this.inboundNet.push(move);
				this.drainInbound();
			},
			onEnd: (winner, reason, youWin) => {
				if (this.session.phase === 'over') return;
				const side =
					winner === 'draw'
						? 'draw'
						: youWin === true
							? this.session.humanSide
							: youWin === false
								? this.session.humanSide === 'white'
									? 'black'
									: 'white'
								: winner;
				this.ui.end(side, reason);
			},
			onError: (error) => {
				if (this.disposed || generation !== this.generation) return;
				this.session.pendingHaptic = null;
				if (error === 'illegal') {
					this.live?.requestState();
					return;
				}
				if (error === 'no_match') {
					this.searchPhase = 'friend-miss';
					this.paintSearch();
					return;
				}
				if (this.onlineBegun || this.session.phase !== 'title') return;
				if (error === 'busy' && this.live?.isOpen()) {
					this.searchPhase = 'waiting';
					this.paintSearch();
					return;
				}
				this.markSearchOffline();
			},
		});
		const attempt = this.live;
		const ok = await attempt.connect();
		if (
			this.disposed ||
			generation !== this.generation ||
			attempt !== this.live
		)
			return;
		if (!ok) {
			this.markSearchOffline();
			return;
		}
		if (kind === 'host') this.live.host();
		else if (kind === 'join') this.live.join(matchId);
		else this.live.queue();
	}

	applyAuthoritativeClocks(snap: MatchSnapshot): void {
		if (!snap.clocks) return;
		this.clock.applySnapshot(snap.clocks, this.ui.now());
		this.dropUntil = snap.clocks.dropUntil ?? 0;
		this.dropServerNow = snap.clocks.serverNow ?? 0;
		this.dropReceivedAt = Date.now();
		if (this.clock.remotePaused) this.session.flagLock = false;
		this.ui.paintClock();
	}

	applyResume(color: Side, snap: MatchSnapshot): void {
		this.session.pendingHaptic = null;
		if (this.session.acceptedResult) return;
		this.session.online = true;
		this.session.humanSide = color;
		this.lastPly = snap.ply;
		this.serverTurn = snap.turn;
		this.onlineBegun = snap.begun || snap.ply > 0;
		if (snap.pieces.length) this.session.position = positionFromSnapshot(snap);
		this.inboundNet = [];
		this.session.moving = false;
		this.session.humanChain = null;
		this.session.selected = null;
		if (snap.begun) this.finishOnlineOpening();
		if (
			!this.session.countingIn &&
			snap.begun &&
			this.session.phase !== 'title'
		) {
			this.session.phase =
				this.serverTurn === this.session.humanSide ? 'human' : 'bot';
		}
		this.applyAuthoritativeClocks(snap);
		this.ui.refresh();
		this.drainInbound();
	}

	finishOnlineOpening(): void {
		if (!this.session.countingIn) return;
		this.ui.stopCountdown();
		markPerf('counting-in-false');
		this.ui.finishOpening();
	}

	applyBegin(snap: MatchSnapshot): void {
		this.session.pendingHaptic = null;
		if (this.session.acceptedResult) return;
		this.onlineBegun = true;
		this.lastPly = snap.ply;
		this.serverTurn = snap.turn;
		if (snap.pieces.length) this.session.position = positionFromSnapshot(snap);
		if (this.session.phase !== 'title') {
			this.session.phase =
				this.serverTurn === this.session.humanSide ? 'human' : 'bot';
		}
		this.finishOnlineOpening();
		this.applyAuthoritativeClocks(snap);
		this.ui.paintClock();
		this.ui.refresh();
		this.drainInbound();
	}

	applyState(snap: MatchSnapshot): void {
		this.session.pendingHaptic = null;
		if (this.session.acceptedResult) return;
		this.lastPly = snap.ply;
		this.serverTurn = snap.turn;
		this.onlineBegun = snap.begun;
		if (snap.pieces.length) this.session.position = positionFromSnapshot(snap);
		this.inboundNet = [];
		this.session.moving = false;
		this.session.humanChain = null;
		this.session.selected = null;
		if (snap.begun) this.finishOnlineOpening();
		if (!this.session.countingIn && this.session.phase !== 'title') {
			this.session.phase = !snap.begun
				? this.session.phase
				: this.serverTurn === this.session.humanSide
					? 'human'
					: 'bot';
		}
		this.applyAuthoritativeClocks(snap);
		this.ui.refresh();
	}

	drainInbound(): void {
		if (
			(this.session.phase === 'over' && !this.session.acceptedResult) ||
			this.session.resultPresented ||
			this.session.moving
		)
			return;
		const next = takeNextPly(this.inboundNet, this.lastPly);
		if (!next) {
			const gap = this.inboundNet.some(
				(m) => classifyPly(this.lastPly, m.ply) === 'gap',
			);
			if (gap && !this.session.acceptedResult) {
				this.live?.requestState();
				return;
			}
			// Confirmed outcome never waits on recovery. If a ply is missing, keep
			// the last confirmed board and do not infer a material/mobility reason.
			if (gap && this.session.resultKind === 'rules')
				this.session.resultKind = 'unknown';
			this.ui.presentResult();
			return;
		}
		this.lastPly = next.ply;
		this.serverTurn = next.turn;
		this.applyingNet = true;
		if (
			next.side === this.session.humanSide &&
			this.session.position.turn !== next.side
		) {
			this.applyingNet = false;
			if (!this.session.acceptedResult)
				this.session.phase =
					this.serverTurn === this.session.humanSide ? 'human' : 'bot';
			this.ui.refresh();
			this.drainInbound();
			return;
		}
		if (next.side === this.session.humanSide) this.ui.playHumanLocal(next);
		else this.ui.playRemote(next);
	}
	isHumanTurn(): boolean {
		return (
			this.onlineBegun &&
			this.serverTurn === this.session.humanSide &&
			this.session.position.turn === this.session.humanSide
		);
	}
	dispose(): void {
		this.disposed = true;
		this.generation++;
		this.stopSearchTicker();
		this.live?.close();
		this.live = null;
		this.inboundNet = [];
	}
}
