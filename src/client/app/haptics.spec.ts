import { expect, it, vi } from 'vitest';
import type { IPosition } from '@/rules';
import { HAPTIC_STORAGE_KEY, Haptics, moveHapticKinds } from './haptics';

function setup(saved: string | null = null) {
	const storage = { getItem: vi.fn(() => saved), setItem: vi.fn() };
	const vibrate = vi.fn(() => true);
	let hidden = false;
	const service = new Haptics({
		storage: () => storage,
		vibrate,
		hidden: () => hidden,
	});
	return {
		service,
		storage,
		vibrate,
		hide: () => {
			hidden = true;
			service.cancel();
		},
	};
}
it('defaults off, preserves the old preference, persists independently and previews enable', () => {
	const a = setup();
	a.service.play('tick');
	expect(a.vibrate).not.toHaveBeenCalled();
	a.service.setEnabled(true);
	expect(a.storage.setItem).toHaveBeenCalledWith(HAPTIC_STORAGE_KEY, 'true');
	expect(a.vibrate.mock.calls).toEqual([[10]]);
	expect(setup('true').service.isEnabled).toBe(true);
	expect(setup('false').service.isEnabled).toBe(false);
});
it('uses one pattern for each semantic action and deduplicates the same action identity', () => {
	const a = setup('true');
	const action = {};
	a.service.play('capture', action);
	a.service.play('capture', action);
	a.service.play('promotion');
	a.service.play('move');
	a.service.play('tick');
	expect(a.vibrate.mock.calls).toEqual([[23], [[12, 45, 12]], [15], [10]]);
});
it('cancels on disable/background and never replays a hidden action', () => {
	const a = setup('true');
	a.service.play('promotion');
	a.service.setEnabled(false);
	expect(a.vibrate.mock.calls).toEqual([[[12, 45, 12]], [0]]);
	a.service.setEnabled(true);
	a.hide();
	a.service.play('capture');
	expect(a.vibrate.mock.calls.at(-1)).toEqual([0]);
});
it('survives denied/missing API, exceptions and inaccessible storage', () => {
	const a = new Haptics({
		storage: () => {
			throw Error('blocked');
		},
		hidden: () => false,
		vibrate: () => {
			throw Error('denied');
		},
	});
	expect(() => {
		a.setEnabled(true);
		a.play('promotion');
		a.setEnabled(false);
	}).not.toThrow();
	const b = setup('true');
	b.vibrate.mockReturnValue(false);
	expect(() => b.service.play('capture')).not.toThrow();
});
const sq = (s: string) => ({ row: +s[1] - 1, col: s.charCodeAt(0) - 97 });
function position(pieces: Record<string, string>): IPosition {
	const p: IPosition = {
		turn: 'white',
		squares: Array.from({ length: 8 }, () => Array(8).fill(null)),
	};
	for (const [n, piece] of Object.entries(pieces)) {
		const s = sq(n);
		p.squares[s.row][s.col] = {
			side: piece[0] === 'w' ? 'white' : 'black',
			kind: piece[1] === 'k' ? 'king' : 'man',
		};
	}
	return p;
}
it('classifies quiet, capture chain and promotion with promotion taking priority', () => {
	expect(
		moveHapticKinds(position({ a3: 'w' }), {
			from: sq('a3'),
			path: [sq('b4')],
		}),
	).toEqual(['move']);
	expect(
		moveHapticKinds(position({ c3: 'w', d4: 'b', f6: 'b' }), {
			from: sq('c3'),
			path: [sq('e5'), sq('g7')],
		}),
	).toEqual(['capture', 'capture']);
	expect(
		moveHapticKinds(position({ b6: 'w', c7: 'b', f6: 'b' }), {
			from: sq('b6'),
			path: [sq('d8'), sq('g5')],
		}),
	).toEqual(['promotion', 'capture']);
	expect(
		moveHapticKinds(position({ c7: 'wk' }), {
			from: sq('c7'),
			path: [sq('d8')],
		}),
	).toEqual(['move']);
});
