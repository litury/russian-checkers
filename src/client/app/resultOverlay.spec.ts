import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
	default: {
		Textures: { FilterMode: { NEAREST: 0 } },
	},
}));

import {
	cheerMs,
	loseHolds,
	loseKeys,
	replayPulseMs,
	replayPulseScale,
	resultAgainCopy,
	resultCatcherDepth,
	resultMenuCopy,
	winKeys,
} from './resultOverlay';

describe('resultOverlay mascot timing', () => {
	it('plays six CRT lose frames with per-frame holds then freezes on 05', () => {
		expect(loseKeys).toHaveLength(6);
		expect(winKeys).toHaveLength(5);
		expect(loseHolds).toEqual([200, 320, 280, 240, 180]);
		expect(loseHolds).toHaveLength(loseKeys.length - 1);
		expect(cheerMs).toBe(120);
	});

	it('breathes the replay button while the overlay is shown', () => {
		expect(replayPulseScale).toBe(1.03);
		expect(replayPulseMs).toBe(800);
		expect(resultAgainCopy).toBe('Ещё раз');
		expect(resultMenuCopy).toBe('В меню');
		expect(resultCatcherDepth).toBeGreaterThan(15);
	});
});
