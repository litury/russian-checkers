import { afterEach, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
	default: {
		Scene: class {},
		Core: { Events: { POST_RENDER: 'postrender' } },
	},
}));
vi.mock('./settings', () => ({
	getAutoMove: () => false,
	getBotSkill: () => 0,
}));

import { hashPosition } from '@/online/matchState';
import { type IMove, type IPosition, legalMoves, type Side } from '@/rules';
import { GameScene } from './gameScene';
import { readPerf, resetPerf } from './perfMarks';

type Listener = () => void;
type Entry = { fn: Listener; once: boolean };

/** Minimal emitter mirroring eventemitter3 semantics (the real Phaser backend). */
class FakeEmitter {
	private listeners = new Map<string, Entry[]>();

	on(event: string, fn: Listener): this {
		const list = this.listeners.get(event) ?? [];
		list.push({ fn, once: false });
		this.listeners.set(event, list);
		return this;
	}

	once(event: string, fn: Listener): this {
		const list = this.listeners.get(event) ?? [];
		list.push({ fn, once: true });
		this.listeners.set(event, list);
		return this;
	}

	off(event: string, fn: Listener): this {
		const list = this.listeners.get(event);
		if (!list) return this;
		this.listeners.set(
			event,
			list.filter((entry) => entry.fn !== fn),
		);
		return this;
	}

	emit(event: string): void {
		const list = [...(this.listeners.get(event) ?? [])];
		for (const entry of list) {
			if (entry.once) this.off(event, entry.fn);
			entry.fn();
		}
	}

	count(event: string): number {
		return this.listeners.get(event)?.length ?? 0;
	}
}

afterEach(() => resetPerf());

function emptyPosition(turn: Side): IPosition {
	return {
		turn,
		squares: Array.from({ length: 8 }, () => Array(8).fill(null)),
	};
}

function oneCaptureFor(turn: Side): IPosition {
	const position = emptyPosition(turn);
	const other: Side = turn === 'white' ? 'black' : 'white';
	// A single capture is the only legal move; the spare men keep the game alive
	// after it, so the test exercises the mark and not the end of the match.
	const spares: Array<[number, number]> =
		turn === 'white'
			? [
					[6, 7],
					[0, 1],
				]
			: [
					[1, 0],
					[7, 6],
				];
	position.squares[2][2] = { side: turn, kind: 'man' };
	position.squares[3][3] = { side: other, kind: 'man' };
	for (const [row, col] of spares) {
		position.squares[row][col] = { side: other, kind: 'man' };
	}
	return position;
}

function setup(options: { turn: Side; humanSide: Side; priorPlies?: number }) {
	const scene = new GameScene() as any;
	const game = new FakeEmitter();
	const sceneEvents = new FakeEmitter();
	const position = oneCaptureFor(options.turn);
	scene.game = { events: game };
	scene.events = sceneEvents;
	scene.position = position;
	scene.humanSide = options.humanSide;
	scene.online = false;
	scene.paused = false;
	scene.phase = 'human';
	scene.moving = false;
	scene.botUndoGen = 0;
	scene.matchPlies = Array.from({ length: options.priorPlies ?? 0 }, () => ({
		side: options.turn === 'white' ? 'black' : 'white',
		from: { row: 0, col: 1 },
		path: [{ row: 1, col: 0 }],
	}));
	scene.posKeys = [hashPosition(position)];
	scene.clocks = { white: 60_000, black: 60_000 };
	scene.settleClock = vi.fn();
	scene.saveBotUndo = vi.fn();
	scene.refresh = vi.fn();
	scene.playBot = vi.fn();
	scene.board = { notePly: vi.fn(), reset: vi.fn() };
	scene.title = { turnHandoff: vi.fn() };
	scene.time = { delayedCall: () => ({ remove: () => {} }) };
	const routes = legalMoves(position);
	expect(routes).toHaveLength(1);
	return { scene, game, sceneEvents, routes, move: routes[0] as IMove };
}

it('marks the first human move when the human plays black after the bot moved', () => {
	// The bot's white ply is already in the log, so the old length===0 gate never fired.
	const { scene, move } = setup({
		turn: 'black',
		humanSide: 'black',
		priorPlies: 1,
	});
	scene.completeHumanMove(move);
	expect(readPerf().marks['first-move-played']).toBeGreaterThanOrEqual(0);
});

it('marks the first human move when the human plays white', () => {
	const { scene, move } = setup({ turn: 'white', humanSide: 'white' });
	scene.completeHumanMove(move);
	expect(readPerf().marks['first-move-played']).toBeGreaterThanOrEqual(0);
});

it('does not mark an opponent ply as the human first move', () => {
	const { scene, move } = setup({ turn: 'white', humanSide: 'black' });
	scene.completeHumanMove(move);
	expect(readPerf().marks['first-move-played']).toBeUndefined();
});

it('marks the first confirmed online human ply without waiting for ply zero', () => {
	const { scene, move } = setup({
		turn: 'black',
		humanSide: 'black',
		priorPlies: 2,
	});
	scene.online = true;
	scene.onlineBegun = true;
	scene.applyingNet = true;
	scene.live = { move: vi.fn() };
	scene.drainInbound = vi.fn();
	scene.playHumanLocal(move);
	expect(readPerf().marks['first-move-played']).toBeGreaterThanOrEqual(0);
});

it('records board-first-frame from the real post-render signal only', () => {
	const { scene, game } = setup({ turn: 'white', humanSide: 'white' });
	scene.markBoardFirstFrame();
	// A frame that was queued but never painted is not a board frame.
	expect(readPerf().marks['board-first-frame']).toBeUndefined();
	game.emit('postrender');
	expect(readPerf().marks['board-first-frame']).toBeGreaterThanOrEqual(0);
	// The listener is consumed by the first frame and never fires twice.
	expect(game.count('postrender')).toBe(0);
	game.emit('postrender');
	expect(readPerf().marks['board-first-frame']).toBeGreaterThanOrEqual(0);
});

it('leaves no listener behind when the scene shuts down before the first frame', () => {
	const { scene, game, sceneEvents } = setup({
		turn: 'white',
		humanSide: 'white',
	});
	scene.markBoardFirstFrame();
	expect(game.count('postrender')).toBe(1);
	sceneEvents.emit('shutdown');
	expect(game.count('postrender')).toBe(0);
	game.emit('postrender');
	expect(readPerf().marks['board-first-frame']).toBeUndefined();
});

it('does not stack a second waiter for a later match start', () => {
	const { scene, game } = setup({ turn: 'white', humanSide: 'white' });
	scene.markBoardFirstFrame();
	scene.markBoardFirstFrame();
	expect(game.count('postrender')).toBe(1);
	game.emit('postrender');
	expect(game.count('postrender')).toBe(0);
});
