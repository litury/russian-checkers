import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { drawReliquaryMarker } from './reliquaryMarkers';

function strokes(
	state: Parameters<typeof drawReliquaryMarker>[2],
	elapsed = 720,
) {
	const result: { color: number; points: number[][] }[] = [];
	let color = 0;
	let points: number[][] = [];
	const g = {
		lineStyle: (_w: number, c: number) => {
			color = c;
		},
		beginPath: () => {
			points = [];
		},
		moveTo: (x: number, y: number) => points.push([x, y]),
		lineTo: (x: number, y: number) => points.push([x, y]),
		fillStyle: (c: number) => {
			color = c;
		},
		fillEllipse: (x: number, y: number, w: number, h: number) =>
			result.push({
				color,
				points: [
					[x, y],
					[w, h],
				],
			}),
		strokePath: () => result.push({ color, points }),
	} as unknown as Phaser.GameObjects.Graphics;
	drawReliquaryMarker(g, { x: 22, y: 22, w: 44, h: 44 }, state, elapsed);
	return result;
}
describe('approved coloured B v2', () => {
	it('keeps the small slate imprint only at destinations, never under a victim', () => {
		expect(strokes('landing').some((s) => s.color === 0x86a6b8)).toBe(true);
		expect(strokes('target').some((s) => s.color === 0x86a6b8)).toBe(false);
	});
	it('draws immediate semantic marks, one travelling copper glint and a static hold', () => {
		expect(strokes('target', 0)).not.toEqual(strokes('target', 720));
		expect(strokes('target', 300).length).toBeGreaterThan(12);
		expect(strokes('target', 720)).toEqual(strokes('target', 7000));
		expect(strokes('landing', 0)).not.toEqual(strokes('landing', 720));
	});
	it('uses identical whole-piece brackets in amber and copper, without victim arcs', () => {
		const selected = strokes('selected').filter((s) => s.color === 0xc9974f);
		const target = strokes('target').filter((s) => s.color === 0xc86643);
		expect(selected).toHaveLength(4);
		expect(target.map((s) => s.points)).toEqual(selected.map((s) => s.points));
		expect(selected[0].points).toEqual([
			[31.4, 39.4],
			[39.4, 39.4],
			[39.4, 31.4],
		]);
		expect(strokes('target')).toHaveLength(12);
	});
	it('uses four steel-blue ticks for ordinary and capture destinations; no hover', () => {
		const move = strokes('move').filter((s) => s.color === 0x779db8);
		expect(move).toHaveLength(4);
		expect(strokes('landing')).toEqual(strokes('move'));
		expect(move[0].points).toEqual([
			[22, 9],
			[22, 4],
		]);
		expect(strokes('hover')).toEqual([]);
	});
});
