import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
	default: {
		Textures: { FilterMode: { NEAREST: 0 } },
	},
}));

import {
	cheerMs,
	loseKeys,
	loseMs,
	replayPulseMs,
	replayPulseScale,
	winKeys,
} from './resultOverlay';

describe('resultOverlay mascot timing', () => {
	it('plays six CRT lose frames slower than the win cheer loop', () => {
		expect(loseKeys).toHaveLength(6);
		expect(winKeys).toHaveLength(5);
		expect(loseMs).toBe(125);
		expect(cheerMs).toBe(120);
		expect(loseMs).toBeGreaterThan(cheerMs);
	});

	it('breathes the replay button while the overlay is shown', () => {
		expect(replayPulseScale).toBe(1.03);
		expect(replayPulseMs).toBe(800);
	});
});
