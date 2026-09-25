import { describe, expect, it } from 'vitest';
import {
	cutRotation,
	halfPolygon,
	splitNormal,
	splitPixels,
} from './captureCut';

describe('captureCut', () => {
	it('aims the authored down-right slash along the screen diagonal', () => {
		expect(cutRotation(1, 1)).toBeCloseTo(0);
		expect(cutRotation(1, -1)).toBeCloseTo(Math.atan2(-1, 1) - Math.PI / 4);
		expect(cutRotation(-1, 1)).toBeCloseTo(Math.atan2(1, -1) - Math.PI / 4);
	});

	it('splits the same pixels into two sides and leaves the cut empty', () => {
		const width = 8;
		const height = 8;
		const pixels = new Uint8ClampedArray(width * height * 4);
		for (let i = 0; i < pixels.length; i += 4) {
			pixels[i] = 20;
			pixels[i + 1] = 30;
			pixels[i + 2] = 40;
			pixels[i + 3] = 255;
		}
		const { a, b } = splitPixels(pixels, width, height, 1, 1);
		const n = splitNormal(1, 1);
		const cx = (width - 1) / 2;
		const cy = (height - 1) / 2;
		let aCount = 0;
		let bCount = 0;
		let gap = 0;
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = (y * width + x) * 4;
				const side = (x - cx) * n.x + (y - cy) * n.y;
				const inA = a[i + 3] === 255;
				const inB = b[i + 3] === 255;
				expect(inA && inB).toBe(false);
				if (inA) {
					aCount += 1;
					expect(side).toBeGreaterThan(0);
					expect(a[i]).toBe(20);
				}
				if (inB) {
					bCount += 1;
					expect(side).toBeLessThan(0);
					expect(b[i]).toBe(20);
				}
				if (!inA && !inB) gap += 1;
			}
		}
		expect(aCount).toBeGreaterThan(8);
		expect(bCount).toBeGreaterThan(8);
		expect(gap).toBeGreaterThan(4);
	});

	it('clips each half to its own side of the diagonal', () => {
		const poly = halfPolygon(160, 160, 1, 1, 1);
		expect(poly.length).toBeGreaterThanOrEqual(3);
		const n = splitNormal(1, 1);
		const cx = 159 / 2;
		const cy = 159 / 2;
		const gap = 160 * 0.045;
		for (const point of poly) {
			const side = (point.x - cx) * n.x + (point.y - cy) * n.y;
			expect(side).toBeGreaterThanOrEqual(gap - 0.01);
		}
	});
});
