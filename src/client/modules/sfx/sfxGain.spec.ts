import { describe, expect, it } from 'vitest';
import {
	clampSfxMaster,
	outputVolume,
	parseSfxMaster,
	parseSfxMuted,
	sfxFadeMs,
	sfxGain,
	sfxMaster,
	sfxMasterAmp,
	sfxStorageKeys,
} from '@/client/modules/sfx/createTableSfx';

describe('sfxGain', () => {
	it('uses per-clip volumes from the 8-bit pack', () => {
		expect(sfxGain.select).toBe(0.28);
		expect(sfxGain.hover).toBe(0.16);
		expect(sfxGain.ignite).toBe(0.58);
		expect(sfxGain.flight).toBe(0.2);
		expect(sfxGain.land).toBe(0.5);
		expect(sfxGain.capture).toBe(0.38);
		expect(sfxGain.hover).toBeLessThan(sfxGain.ignite);
		expect(sfxGain.hover).toBeLessThan(sfxGain.land);
		expect(sfxGain.flight).toBeLessThan(sfxGain.land);
	});

	it('fades engine loops instead of hard stop', () => {
		expect(sfxFadeMs.in).toBe(100);
		expect(sfxFadeMs.out).toBe(150);
	});

	it('applies a log master gain defaulted to 0.4', () => {
		expect(sfxMaster).toBe(0.4);
		expect(sfxMasterAmp(0)).toBe(0);
		expect(sfxMasterAmp(1)).toBe(1);
		expect(sfxMasterAmp(0.4)).toBeCloseTo((10 ** 0.4 - 1) / 9);
		expect(sfxMasterAmp(0.4)).toBeLessThan(0.4);
	});

	it('maps the slider through log amp and keeps mute memory', () => {
		expect(sfxStorageKeys.master).toBe('checkers.sfxMaster');
		expect(sfxStorageKeys.muted).toBe('checkers.sfxMuted');
		expect(parseSfxMaster(null)).toBe(sfxMaster);
		expect(parseSfxMaster('0.8')).toBe(0.8);
		expect(clampSfxMaster(2)).toBe(1);
		expect(clampSfxMaster(-1)).toBe(0);
		expect(parseSfxMuted('1')).toBe(true);
		expect(parseSfxMuted('0')).toBe(false);
		expect(outputVolume(0.4, false)).toBe(sfxMasterAmp(0.4));
		expect(outputVolume(0.4, false)).not.toBe(0.4);
		expect(outputVolume(0.4, true)).toBe(0);
		expect(outputVolume(0.4, true)).toBe(sfxMasterAmp(0));
		expect(outputVolume(0.8, true)).toBe(0);
	});
});
