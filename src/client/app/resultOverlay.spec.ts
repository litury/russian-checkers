import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
	default: {
		Textures: { FilterMode: { NEAREST: 0 } },
	},
}));

import {
	cheerMs,
	idleKeys,
	idleMs,
	loseHolds,
	loseKeys,
	replayPulseMs,
	replayPulseScale,
	resultAgainCopy,
	resultCatcherDepth,
	resultMenuCopy,
	winKeys,
} from './resultOverlay';
import { grassSway } from '@/client/config/layout';
import { musicGain } from '@/client/modules/sfx/createTableSfx';

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

	it('idles mascot after cheer/lose and sways grass tufts quietly', () => {
		expect(idleKeys).toEqual([
			'mascotIdle0',
			'mascotIdle1',
			'mascotIdle2',
			'mascotIdle3',
		]);
		expect(idleMs).toBeGreaterThanOrEqual(200);
		expect(grassSway.keys).toHaveLength(3);
		expect(grassSway.cycle).toEqual([0, 1, 2, 1]);
		expect(musicGain.meadow).toBeGreaterThanOrEqual(0.02);
		expect(musicGain.meadow).toBeLessThanOrEqual(0.05);
	});
});
