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
import { musicGain } from '@/client/modules/sfx/createTableSfx';

describe('resultOverlay mascot timing', () => {
	it('provides nine approved frames for each human side and final hold', () => {
		expect(loseKeys.white).toHaveLength(9);
		expect(loseKeys.black).toHaveLength(9);
		expect(loseKeys.white[0]).toBe('checkerDefeat_white_00');
		expect(loseKeys.black[8]).toBe('checkerDefeat_black_08');
		expect(winKeys).toHaveLength(5);
		expect(loseHolds).toEqual([350,160,140,120,120,150,180,250,1200]);
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
		expect(musicGain.meadow).toBeGreaterThanOrEqual(0.02);
		expect(musicGain.meadow).toBeLessThanOrEqual(0.05);
	});
});
