import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
	default: {
		Textures: { FilterMode: { NEAREST: 0 } },
	},
}));

import {
	idleBobY,
	idleKeys,
	idleMs,
	titleBotCopy,
	titleColor,
	titleCopy,
	titleHeroFit,
	titleOnlineCopy,
	titleRowMinWidth,
	titleStroke,
} from './titleOverlay';

describe('titleOverlay', () => {
	it('uses live title copy and idle mascot contain size', () => {
		expect(titleCopy).toBe('Русские шашки');
		expect(titleBotCopy).toBe('Играть');
		expect(titleOnlineCopy).toBe('Онлайн');
		expect(titleColor).toBe('#F4EFE4');
		expect(titleStroke).toBe('#1A1410');
		expect(titleHeroFit).toBe(120);
		expect(titleRowMinWidth).toBe(460);
		expect(idleKeys).toEqual([
			'mascotIdle0',
			'mascotIdle1',
			'mascotIdle2',
			'mascotIdle3',
		]);
		expect(idleBobY).toEqual([0, -1, 0, 1]);
		expect(idleMs).toBe(180);
	});
});
