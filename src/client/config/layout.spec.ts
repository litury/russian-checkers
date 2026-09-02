import { describe, expect, it } from 'vitest';
import { layout } from '@/client/config/layout';

describe('layout capture burst', () => {
	it('bursts the lid into shards instead of sinking', () => {
		expect('capturePopMs' in layout).toBe(false);
		expect(layout.captureBurstMs).toBe(200);
		expect(layout.captureShardCount).toBe(7);
		expect(layout.captureShardCount).toBeGreaterThanOrEqual(6);
		expect(layout.captureShardCount).toBeLessThanOrEqual(8);
	});
});
