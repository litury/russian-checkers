/** Authored cut.png points down-right. The tip sits 45° from the canvas center. */
export const CUT_NATURAL = Math.PI / 4;

/** Rotation that aims the one cut sprite along a screen diagonal. */
export function cutRotation(dx: number, dy: number): number {
	return Math.atan2(dy, dx) - CUT_NATURAL;
}

/** Unit normal of the cut. Halves travel along this and its opposite. */
export function splitNormal(dx: number, dy: number): { x: number; y: number } {
	const x = -dy;
	const y = dx;
	const len = Math.hypot(x, y) || 1;
	return { x: x / len, y: y / len };
}

/**
 * Cut RGBA pixels along the diagonal through the center.
 * The band on the cut stays empty so the slash reads between the halves.
 * Does not redraw the piece: each half is a masked copy of the same pixels.
 */
export function splitPixels(
	pixels: Uint8ClampedArray,
	width: number,
	height: number,
	dx: number,
	dy: number,
): { a: Uint8ClampedArray; b: Uint8ClampedArray } {
	const a = new Uint8ClampedArray(pixels.length);
	const b = new Uint8ClampedArray(pixels.length);
	const n = splitNormal(dx, dy);
	const cx = (width - 1) / 2;
	const cy = (height - 1) / 2;
	const gap = Math.max(1.25, Math.min(width, height) * 0.045);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const side = (x - cx) * n.x + (y - cy) * n.y;
			if (Math.abs(side) <= gap) continue;
			const i = (y * width + x) * 4;
			const dest = side > 0 ? a : b;
			dest[i] = pixels[i]!;
			dest[i + 1] = pixels[i + 1]!;
			dest[i + 2] = pixels[i + 2]!;
			dest[i + 3] = pixels[i + 3]!;
		}
	}
	return { a, b };
}

/** One side of the cut, as a polygon in texture pixels. sign is 1 or -1. */
export function halfPolygon(
	width: number,
	height: number,
	dx: number,
	dy: number,
	sign: number,
): { x: number; y: number }[] {
	const n = splitNormal(dx, dy);
	const nx = n.x * sign;
	const ny = n.y * sign;
	const cx = (width - 1) / 2;
	const cy = (height - 1) / 2;
	const gap = Math.max(1.25, Math.min(width, height) * 0.045);
	const inside = (x: number, y: number) => (x - cx) * nx + (y - cy) * ny >= gap;
	const corners = [
		{ x: 0, y: 0 },
		{ x: width, y: 0 },
		{ x: width, y: height },
		{ x: 0, y: height },
	];
	const poly: { x: number; y: number }[] = [];
	for (let i = 0; i < corners.length; i++) {
		const a = corners[i]!;
		const b = corners[(i + 1) % corners.length]!;
		const aIn = inside(a.x, a.y);
		const bIn = inside(b.x, b.y);
		if (aIn) poly.push(a);
		if (aIn !== bIn) {
			const da = (a.x - cx) * nx + (a.y - cy) * ny - gap;
			const db = (b.x - cx) * nx + (b.y - cy) * ny - gap;
			const t = da / (da - db || 1);
			poly.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
		}
	}
	return poly;
}
