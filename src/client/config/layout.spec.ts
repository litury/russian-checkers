import { describe, expect, it } from 'vitest';
import { captureSprites, layout } from '@/client/config/layout';

describe('layout capture burst', () => {
	it('plays ignite swell flash instead of lid scale or sink', () => {
		expect('capturePopMs' in layout).toBe(false);
		expect('captureSquashMs' in layout).toBe(false);
		expect('captureSinkMs' in layout).toBe(false);
		expect(layout.captureBurstMs).toBe(70);
		expect(captureSprites.igniteLight).toBe('captureIgniteLight');
		expect(captureSprites.igniteDark).toBe('captureIgniteDark');
		expect(captureSprites.igniteKingLight).toBe('captureIgniteKingLight');
		expect(captureSprites.igniteKingDark).toBe('captureIgniteKingDark');
		expect(captureSprites.swellLight).toHaveLength(3);
		expect(captureSprites.swellDark).toHaveLength(3);
		expect(captureSprites.swellKingLight).toHaveLength(3);
		expect(captureSprites.swellKingDark).toHaveLength(3);
		expect(captureSprites.burstLight).toHaveLength(2);
		expect(captureSprites.burstDark).toHaveLength(2);
		expect(captureSprites.burstKingLight).toHaveLength(2);
		expect(captureSprites.burstKingDark).toHaveLength(2);
		expect(captureSprites.smolderLight).toHaveLength(2);
		expect(captureSprites.smolderDark).toHaveLength(2);
		expect(captureSprites.smolderKingLight).toHaveLength(2);
		expect(captureSprites.smolderKingDark).toHaveLength(2);
		expect(captureSprites.flash).toHaveLength(4);
		expect(captureSprites.scorch).toBe('captureScorch');
	});
});
