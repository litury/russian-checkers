import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('./settings', () => ({ getAutoMove: () => auto, getBotSkill: () => 'normal' }));
import { GameScene } from './gameScene';
import { apply, legalMoves, type IPosition } from '@/rules';
let auto = false;
const sq = (s: string) => ({ row: +s[1] - 1, col: s.charCodeAt(0) - 97 });
function setup(pieces: Record<string, string>, turn = 'white') {
	const s = new GameScene() as any;
	const position: IPosition = {
		turn: turn as 'white' | 'black',
		squares: Array.from({ length: 8 }, () => Array(8).fill(null)),
	};
	for (const [n, p] of Object.entries(pieces)) {
		const a = sq(n);
		position.squares[a.row][a.col] = {
			side: p[0] === 'w' ? 'white' : 'black',
			kind: p[1] === 'k' ? 'king' : 'man',
		};
	}
	s.position = position;
	s.phase = turn === 'white' ? 'human' : 'bot';
	s.time = { now: 1000, delayedCall: vi.fn(() => ({ remove: vi.fn() })) };
	s.clockStartedAt = 100;
	s.hud = { setTurn: vi.fn(), setClock: vi.fn() };
	s.board = {
		clearOpeningHint: vi.fn(),
		reset: vi.fn(),
		sync: vi.fn(),
		setWaitingIdle: vi.fn(),
		playMove: vi.fn((_m, done) => done()),
		notePly: vi.fn(),
		deny: vi.fn(),
	};
	s.sdk = { showFullscreenAdv: vi.fn() };
	return s;
}
beforeEach(() => {
	auto = false;
	const undoButton = { hidden: true, disabled: true };
	vi.stubGlobal('document', {
		getElementById: (id: string) => id === 'match-undo' ? undoButton : null,
	});
});
afterEach(() => vi.unstubAllGlobals());
it('clicks a shared first hop, locks selection, then settles exactly one full human turn', () => {
	const s = setup({ c3: 'w', a1: 'w', d4: 'b', f4: 'b', f6: 'b', h8: 'b' });
	const origin = structuredClone(s.position);
	const settle = vi.spyOn(s, 'settleClock');
	s.onSquare(sq('c3'));
	expect(s.humanHighlights()).toEqual([sq('e5')]);
	s.onSquare(sq('g7'));
	expect(s.board.playMove).not.toHaveBeenCalled();
	s.onSquare(sq('c3'));
	s.onSquare(sq('e5'));
	expect(s.board.playMove.mock.calls[0][0]).toEqual({
		from: sq('c3'),
		path: [sq('e5')],
	});
	expect(s.position).toEqual(origin);
	expect(s.selected).toEqual(sq('e5'));
	expect(s.humanHighlights()).toEqual(
		expect.arrayContaining([sq('g3'), sq('g7')]),
	);
	expect(settle).not.toHaveBeenCalled();
	expect(s.clockStartedAt).toBe(100);
	expect(s.phase).toBe('human');
	s.onSquare(sq('a1'));
	s.onSquare(sq('c3'));
	s.cancelSelection();
	expect(s.selected).toEqual(sq('e5'));
	s.time.now = 2100;
	s.onSquare(sq('g3'));
	expect(s.board.playMove).toHaveBeenCalledTimes(2);
	expect(s.board.playMove.mock.calls[1][0]).toEqual({
		from: sq('e5'),
		path: [sq('g3')],
	});
	expect(s.position).toEqual(
		apply(origin, { from: sq('c3'), path: [sq('e5'), sq('g3')] }),
	);
	expect(settle).toHaveBeenCalledTimes(1);
	expect(s.clocks.white).toBe(58000);
	expect(s.clockStartedAt).toBe(2100);
	expect(s.board.notePly).toHaveBeenCalledTimes(1);
	expect(s.time.delayedCall).toHaveBeenCalledTimes(1);
	expect(s.phase).toBe('bot');
});
it('waits for manual forced continuation with auto disabled', () => {
	const s = setup({ c3: 'w', d4: 'b', f6: 'b', h8: 'b' });
	s.onSquare(sq('c3'));
	s.onSquare(sq('e5'));
	s.refresh();
	expect(s.board.playMove).toHaveBeenCalledTimes(1);
	expect(s.selected).toEqual(sq('e5'));
	expect(s.humanHighlights()).toEqual([sq('g7')]);
});
it('sends every remaining branch to the renderer while input stays next-hop only', () => {
	const s = setup({ c3: 'w', d4: 'b', f4: 'b', f6: 'b' });
	auto = true;
	s.onSquare(sq('c3'));
	expect(s.board.sync.mock.calls.at(-1)[3]).toEqual(legalMoves(s.position));
	expect(s.humanHighlights()).toEqual([sq('e5')]);
	expect(s.board.playMove).not.toHaveBeenCalled();
	s.onSquare(sq('e5'));
	expect(s.board.sync.mock.calls.at(-1)[3]).toEqual(
		legalMoves(s.position).map(m => ({ from: sq('e5'), path: m.path.slice(1) })),
	);
});

it('auto never chooses a genuine branch or takes over a manually started route', () => {
	auto = true;
	const s = setup({ c3: 'w', d4: 'b', f4: 'b', f6: 'b', h8: 'b' });
	s.refresh();
	expect(s.board.playMove).not.toHaveBeenCalled();
	s.onSquare(sq('c3'));
	s.onSquare(sq('e5'));
	s.refresh();
	expect(s.board.playMove).toHaveBeenCalledTimes(1);
	expect(s.selected).toEqual(sq('e5'));
});
it('preserves sole full-route auto and bot animation/clock settlement', () => {
	auto = true;
	const s = setup({ c3: 'w', d4: 'b', f6: 'b', h8: 'b' });
	const route = legalMoves(s.position)[0];
	s.refresh();
	expect(s.board.playMove.mock.calls[0][0]).toEqual(route);
	expect(s.phase).toBe('bot');
	auto = false;
	const b = setup({ f6: 'b', e5: 'w', c3: 'w', a1: 'w' }, 'black');
	const origin = structuredClone(b.position);
	const settle = vi.spyOn(b, 'settleClock');
	b.playBot();
	const move = b.board.playMove.mock.calls[0][0];
	expect(legalMoves(origin)).toContainEqual(move);
	expect(move.path.length).toBeGreaterThan(1);
	expect(b.position).toEqual(apply(origin, move));
	expect(settle).toHaveBeenCalledTimes(1);
	expect(b.phase).toBe('human');
});

it('keeps input locked during each animation and retains captured sprites until commit', () => {
	const s = setup({ c3: 'w', d4: 'b', f6: 'b', h8: 'b' });
	let finish = () => {};
	s.board.playMove.mockImplementation((_m: unknown, done: () => void) => {
		finish = done;
	});
	s.onSquare(sq('c3'));
	s.onSquare(sq('e5'));
	expect(s.moving).toBe(true);
	expect(s.board.playMove.mock.calls[0][4]).toBe(true);
	s.onSquare(sq('g7'));
	s.cancelSelection();
	expect(s.board.playMove).toHaveBeenCalledTimes(1);
	finish();
	expect(s.moving).toBe(false);
	expect(s.selected).toEqual(sq('e5'));
	const projected = s.board.sync.mock.calls.at(-1)[0];
	expect(projected.squares[3][3]?.side).toBe('black');
	expect(projected.squares[4][4]?.side).toBe('white');
});

it('flags during a branch decision without settling a partial move or resetting the clock', () => {
	const s = setup({ c3: 'w', d4: 'b', f6: 'b', h8: 'b' });
	const settle = vi.spyOn(s, 'settleClock');
	s.onSquare(sq('c3'));
	s.onSquare(sq('e5'));
	s.time.now = 60101;
	s.tickClock();
	expect(s.phase).toBe('over');
	expect(settle).not.toHaveBeenCalled();
	expect(s.clockStartedAt).toBe(100);
	s.onSquare(sq('g7'));
	expect(s.position.turn).toBe('white');
});

it('does not commit a final hop after time has expired', () => {
	const s = setup({ c3: 'w', d4: 'b', f6: 'b', h8: 'b' });
	const settle = vi.spyOn(s, 'settleClock');
	s.onSquare(sq('c3'));
	s.onSquare(sq('e5'));
	s.time.now = 60101;
	s.onSquare(sq('g7'));
	expect(s.phase).toBe('over');
	expect(settle).not.toHaveBeenCalled();
	expect(s.position.turn).toBe('white');
});
