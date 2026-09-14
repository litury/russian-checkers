import type Phaser from 'phaser';
import { markerPhase } from './reliquaryMotion';

export type Marker =
	| 'selected'
	| 'move'
	| 'landing'
	| 'futureLanding'
	| 'target'
	| 'focus'
	| 'hover';

const mix = (a: number, b: number, t: number): number => {
	let color = 0;
	for (const shift of [16, 8, 0])
		color |=
			Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) <<
			shift;
	return color;
};

/** Approved coloured Б / motion-v2 geometry, expressed in 44px cell units. */
export function drawReliquaryMarker(
	g: Phaser.GameObjects.Graphics,
	box: { x: number; y: number; w: number; h: number },
	state: Marker,
	elapsed = 720,
): void {
	const phase = markerPhase(elapsed);
	const u = Math.min(box.w, box.h) / 44;
	const path = (points: number[][], width: number, color: number): void => {
		g.lineStyle(width * u, color, 1);
		g.beginPath();
		points.forEach(([x, y], i) => {
			const px = box.x - box.w / 2 + x * u,
				py = box.y - box.h / 2 + y * u;
			if (i === 0) g.moveTo(px, py);
			else g.lineTo(px, py);
		});
		g.strokePath();
	};
	const stroke = (
		points: number[][],
		color: number,
		width = 1.7,
		bevel = false,
	): void => {
		path(points, width + 1.8, 0x101619);
		if (bevel) path(points, width + 0.7, mix(color, 0xe1d3ac, 0.4));
		path(points, width, color);
	};
	if (state === 'selected' || state === 'target') {
		const r = phase.radius;
		for (const [sx, sy] of [
			[1, 1],
			[-1, 1],
			[1, -1],
			[-1, -1],
		]) {
			const pts = [
				[22 + sx * (r - 8), 22 + sy * r],
				[22 + sx * r, 22 + sy * r],
				[22 + sx * r, 22 + sy * (r - 8)],
			];
			stroke(
				pts,
				state === 'selected'
					? mix(0xc9974f, 0xe4ba75, phase.amber)
					: mix(0xc86643, 0xf6c99b, phase.pulse * 0.28),
				2,
				true,
			);
			if (state === 'target' && phase.glint > 0) {
				const lo = phase.progress * 23 - 7,
					hi = phase.progress * 23;
				for (let i = 0; i < 2; i++) {
					const a = pts[i],
						b = pts[i + 1],
						start = Math.max(0, (lo - i * 8) / 8),
						end = Math.min(1, (hi - i * 8) / 8);
					if (end > start)
						path(
							[start, end].map((t) => [
								a[0] + (b[0] - a[0]) * t,
								a[1] + (b[1] - a[1]) * t,
							]),
							2,
							mix(0xc86643, 0xf6c99b, phase.glint),
						);
				}
			}
		}
	} else if (state === 'move' || state === 'landing' || state === 'futureLanding') {
		const future = state === 'futureLanding';
		// Soft local slate imprint (not a ring/ghost); layered vector falloff avoids an FBO.
		for (let i = 6; i >= 0; i--) {
			g.fillStyle(0x86a6b8, (27 / 255 / 7) * (1 + phase.blue / 0.75) * (future ? 0.5 : 1));
			g.fillEllipse(box.x, box.y + u, (18 + i * 2) * u, (12 + i * 2) * u);
		}

		for (const [vx, vy] of [
			[0, -1],
			[1, 0],
			[0, 1],
			[-1, 0],
		])
			stroke(
				[
					[22 + vx * (11.5 + phase.opening), 22 + vy * (11.5 + phase.opening)],
					[22 + vx * (16.5 + phase.opening), 22 + vy * (16.5 + phase.opening)],
				],
				mix(
					future ? 0x55758a : 0x779db8,
					future ? 0x7793a5 : 0xaac1cf,
					phase.blue + (state === 'landing' ? phase.pulse * 0.14 : 0),
				),
			);
	} else if (state === 'focus') {
		for (let a = 3; a < 40; a += 7) {
			const b = Math.min(a + 3, 41);
			for (const pts of [
				[
					[a, 2],
					[b, 2],
				],
				[
					[a, 42],
					[b, 42],
				],
				[
					[2, a],
					[2, b],
				],
				[
					[42, a],
					[42, b],
				],
			])
				stroke(pts, 0xeee4ca, 1.7);
		}
	}
}
