import {describe, expect, it} from 'vitest';
import {createInitialPosition, legalMoves} from '@/rules';
import {squareAlg} from './notation';
import {applyPly} from './replay';
import scene from '../client/app/gameScene.ts?raw';
import {
	READY_MS,
	bothReady,
	classifyPly,
	hashPosition,
	positionFromSnapshot,
	snapshotOf,
	takeNextPly,
} from './matchState';

describe('match state sync', () => {
	it('hashes the same initial board the same way', () => {
		const a = hashPosition(createInitialPosition());
		const b = hashPosition(createInitialPosition());
		expect(a).toBe(b);
		expect(a.length).toBeGreaterThan(8);
	});

	it('requests state on a ply gap and applies consecutive plies from a queue', () => {
		expect(classifyPly(0, 2)).toBe('gap');
		expect(classifyPly(0, 1)).toBe('apply');
		expect(classifyPly(2, 2)).toBe('stale');
		const buf = [{ply: 2}, {ply: 1}];
		expect(takeNextPly(buf, 0)?.ply).toBe(1);
		expect(takeNextPly(buf, 1)?.ply).toBe(2);
		expect(buf).toEqual([]);
	});

	it('round-trips a snapshot after one ply', () => {
		const start = createInitialPosition();
		const move = legalMoves(start)[0];
		const next = applyPly(start, {side: 'white', from: squareAlg(move.from), path: move.path.map(squareAlg)});
		expect(next).toBeTruthy();
		const snap = snapshotOf('m1', next!, 1, false);
		expect(snap.ply).toBe(1);
		expect(snap.turn).toBe('black');
		expect(snap.hash).toBe(hashPosition(next!));
		const restored = positionFromSnapshot(snap);
		expect(hashPosition(restored)).toBe(snap.hash);
		expect(restored.turn).toBe('black');
	});

	it('begin only after both ready; timeout window is 20–30s', () => {
		expect(bothReady(new Set(['w']), 'w', 'b')).toBe(false);
		expect(bothReady(new Set(['w', 'b']), 'w', 'b')).toBe(true);
		expect(READY_MS).toBeGreaterThanOrEqual(20_000);
		expect(READY_MS).toBeLessThanOrEqual(30_000);
	});

	it('does not drop inbound moves while animating and waits for begin', () => {
		expect(scene).toContain('drainInbound');
		expect(scene).toContain('this.inboundNet.push(move)');
		expect(scene).not.toContain('if (this.phase === \'over\' || this.moving) return;\n				if (side === this.humanSide)');
		expect(scene).toContain('live?.ready()');
		expect(scene).toContain('onlineBegun');
	});
});

