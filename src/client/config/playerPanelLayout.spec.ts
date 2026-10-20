import { expect, it } from 'vitest';
import { matchLayout } from './matchLayout';
import { playerPanelLayout } from './playerPanelLayout';

it.each([
	[320, 568],
	[375, 667],
	[375, 550],
	[360, 780],
])('fills the space below the unchanged board at %s × %s', (width, height) => {
	const safe = { top: 0, bottom: 0, left: 0, right: 0 };
	const layout = matchLayout(width, height, safe);
	const original = structuredClone(layout);
	const panel = playerPanelLayout(layout, width, height, safe);
	expect(layout).toEqual(original);
	expect(matchLayout(width, height, safe)).toEqual(original);
	expect(panel.x).toBe(2);
	expect(panel.scaleX * 374).toBeCloseTo(width - 4);
	expect(panel.y).toBeCloseTo(
		layout.originY + layout.fieldSize + 33 * layout.scale + 4,
	);
	expect(panel.scaleY * 128).toBeCloseTo(
		Math.min(128, height - 4 - panel.y, layout.originY - 33 * layout.scale - 8),
	);
});

it.each([
	[320, 568],
	[375, 550],
	[375, 667],
	[393, 852],
	[768, 1024],
	[844, 390],
	[1024, 768],
	[1280, 720],
	[1920, 1080],
])(
	'uses equally wide panels on opposite sides of the board at %s × %s',
	(width, height) => {
		for (const safe of [
			{ top: 0, bottom: 0, left: 0, right: 0 },
			{ top: 44, bottom: 34, left: 12, right: 12 },
		]) {
			const layout = matchLayout(width, height, safe);
			const own = playerPanelLayout(layout, width, height, safe);
			const foe = playerPanelLayout(layout, width, height, safe, 'foe');
			expect(foe.x).toBe(own.x);
			expect(foe.scaleX).toBe(own.scaleX);
			expect(foe.scaleY).toBe(own.scaleY);
			expect(foe.y).toBeGreaterThanOrEqual(safe.top);
			expect(foe.y + 128 * foe.scaleY).toBeCloseTo(
				layout.originY - 33 * layout.scale - 4,
			);
			expect(own.y).toBeCloseTo(
				layout.originY + layout.fieldSize + 33 * layout.scale + 4,
			);
			expect(own.y + 128 * own.scaleY).toBeLessThanOrEqual(
				height - safe.bottom,
			);
			expect(own.x).toBeGreaterThanOrEqual(safe.left);
			expect(own.x + 374 * own.scaleX).toBeLessThanOrEqual(width - safe.right);
			expect(own.scaleY).toBeGreaterThan(0);
		}
	},
);

it('retains the pre-fix iPhone SE board size and position', () => {
	const layout = matchLayout(375, 667);
	expect(layout.fieldSize).toBeCloseTo((371 * 352) / 380);
	expect(layout.originY).toBeCloseTo(
		12 + 128 * 0.761328125 + 20 + (33 * 371) / 380,
	);
	expect(layout.panelScale).toBeCloseTo(0.761328125);
});
