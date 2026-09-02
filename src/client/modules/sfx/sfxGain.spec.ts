import { describe, expect, it } from 'vitest';
import { sfxGain } from '@/client/modules/sfx/createTableSfx';

describe('sfxGain', () => {
	it('uses per-clip volumes from the 8-bit pack', () => {
		expect(sfxGain.select).toBe(0.28);
		expect(sfxGain.hover).toBe(0.16);
		expect(sfxGain.ignite).toBe(0.58);
		expect(sfxGain.flight).toBe(0.4);
		expect(sfxGain.land).toBe(0.5);
		expect(sfxGain.capture).toBe(0.38);
	});
});
