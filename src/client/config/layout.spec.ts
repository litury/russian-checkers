import { describe, expect, it } from 'vitest';
import {
	captureSprites,
	hopPathReady,
	layout,
	pathSprites,
} from '@/client/config/layout';

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

describe('hop path stamps', () => {
	it('refuses to stamp until cell is positive so dash spacing is not zero', () => {
		expect(pathSprites.dash).toBe('pathDash');
		expect(pathSprites.cross).toBe('pathCross');
		expect(hopPathReady(0)).toBe(false);
		expect(hopPathReady(Number.NaN)).toBe(false);
		expect(hopPathReady(-1)).toBe(false);
		expect(hopPathReady(layout.minCellPx)).toBe(true);
		expect(layout.hopDashPxPerSec).toBe(48);
	});
});

describe('hud action moat', () => {
	it('sizes the empty moat and clears the field by inset plus moat', () => {
		expect(layout.hudMoatW).toBe(384);
		expect(layout.hudMoatBtnInset).toBe(10);
		expect(layout.hudMoatH).toBe(104);
		expect(layout.hudStripInset).toBe(14);
		expect(layout.boardBottomGap).toBe(128);
		expect(layout.hudMoatResignX).toBe(42);
		expect(layout.hudMoatResignY).toBe(52);
		expect(layout.hudMoatAiX).toBe(342);
		expect(layout.hudMoatAiY).toBe(52);
		expect(layout.hudStripInset + layout.hudMoatH).toBeLessThanOrEqual(
			layout.boardBottomGap,
		);
		expect(layout.hudResign).toBe(64);
		expect(layout.hudAiW).toBe(64);
		expect(layout.hudAiH).toBe(48);
		expect(layout.hudAction).toBe(64);
		expect(
			layout.hudMoatResignX - layout.hudResign / 2,
		).toBeGreaterThanOrEqual(layout.hudMoatBtnInset);
		expect(
			layout.hudMoatW - (layout.hudMoatAiX + layout.hudAiW / 2),
		).toBeGreaterThanOrEqual(layout.hudMoatBtnInset);
		expect(layout.hudMoatResignX).not.toBe(layout.hudMoatW / 2);
		expect(layout.hudMoatAiX).not.toBe(layout.hudMoatW / 2);
		expect(
			layout.boardBottomGap - layout.hudStripInset - layout.hudMoatH,
		).toBeGreaterThanOrEqual(layout.hudMoatBtnInset);
	});
});
