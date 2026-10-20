import { expect, it } from 'vitest';
import { matchActionGeometry } from './matchActionGeometry';
import { matchLayout } from '../config/matchLayout';
import { playerPanelLayout } from '../config/playerPanelLayout';

it.each([
	[320, 568],
	[375, 667],
	[375, 550],
	[360, 780],
	[393, 852],
	[390, 844],
	[844, 390],
	[1280, 720],
	[1024, 768],
])(
	'keeps 44px actions inside the panel and clear of the clock at %s × %s',
	(width, height) => {
		for (const safe of [
			{ top: 0, bottom: 0, left: 0, right: 0 },
			{ top: 44, bottom: 34, left: 12, right: 12 },
		]) {
			const layout = matchLayout(width, height, safe);
			const card = playerPanelLayout(layout, width, height, safe);
			const box = matchActionGeometry(card);
			expect(box.width).toBeLessThanOrEqual(192);
			expect(box.width / 2).toBeGreaterThanOrEqual(44);
			expect(box.height).toBe(44);
			expect(box.left).toBeGreaterThanOrEqual(card.x);
			expect(box.top).toBeGreaterThanOrEqual(card.y);
			expect(box.top + box.height).toBeLessThanOrEqual(
				card.y + 128 * card.scaleY,
			);
			expect(box.left + box.width + 8).toBeLessThanOrEqual(
				card.x + 223 * card.scaleX + 0.001,
			);
			expect(card.x).toBeGreaterThanOrEqual(safe.left);
			expect(card.x + 374 * card.scaleX).toBeLessThanOrEqual(
				width - safe.right + 0.001,
			);
			expect(card.y + 128 * card.scaleY).toBeLessThanOrEqual(
				height - safe.bottom + 0.001,
			);
			if (layout.mode === 'top-bottom') {
				expect(card.y).toBeGreaterThanOrEqual(
					layout.originY + layout.fieldSize + 33 * layout.scale + 4 - 0.001,
				);
			}
		}
	},
);

it('keeps full-size controls inside the wider panel on a roomy phone', () => {
	const layout = matchLayout(393, 852);
	const safe = { top: 0, bottom: 0, left: 0, right: 0 };
	const card = playerPanelLayout(layout, 393, 852, safe);
	expect(card.scaleX * 374).toBeCloseTo(389);
	expect(card.scaleY).toBe(1);
	expect(matchActionGeometry(card).width).toBe(192);
});

it('places the explanation below a card close to the viewport top', () => {
	expect(
		matchActionGeometry({ x: 0, y: 48, scaleX: 1, scaleY: 1 }).tooltipBelow,
	).toBe(true);
	expect(
		matchActionGeometry({ x: 0, y: 49, scaleX: 1, scaleY: 1 }).tooltipBelow,
	).toBe(false);
});
