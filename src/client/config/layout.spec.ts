import { describe, expect, it } from 'vitest';
import { layout } from '@/client/config/layout';

describe('hud action moat', () => {
	it('has no full-width shore; action stones are native size', () => {
		expect(layout.hudAiW).toBe(44);
		expect(layout.hudAiH).toBe(44);
		expect(layout.hudActionGap).toBe(16);
		expect(layout.boardBottomGap).toBe(80);
		expect('hudMoatW' in layout).toBe(false);
		expect('hudMoatTileW' in layout).toBe(false);
		expect('hudSideInset' in layout).toBe(false);
	});
});
