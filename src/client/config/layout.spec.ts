import { describe, expect, it } from 'vitest';
import { layout } from '@/client/config/layout';

describe('layout capture burst', () => {
	it('pops the lid then bursts shards instead of sinking', () => {
		expect(layout.capturePopMs).toBe(40);
		expect(layout.captureBurstMs).toBe(200);
		expect(layout.captureShardCount).toBe(7);
		expect(layout.captureShardCount).toBeGreaterThanOrEqual(6);
		expect(layout.captureShardCount).toBeLessThanOrEqual(8);
	});
});
