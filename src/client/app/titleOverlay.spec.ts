import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
	default: {
		Textures: { FilterMode: { NEAREST: 0 } },
	},
}));

import {
	coverScale,
	pickTitleBgKey,
	titleBgLandscape,
	titleBgPortrait,
	titleBotCopy,
	titleBtnBase,
	titleBtnFill,
	titleBtnHighlight,
	titleBtnStroke,
	titleColor,
	titleCopy,
	titleOnlineAlpha,
	titleOnlineCopy,
	titlePlateH,
	titlePlateW,
	titlePortraitMinRatio,
	titlePressNudge,
	titleRowMinWidth,
	titleStroke,
} from './titleOverlay';

describe('titleOverlay', () => {
	it('is a title plus play/online plates, no idle mascot', () => {
		expect(titleCopy).toBe('Русские шашки');
		expect(titleBotCopy).toBe('Играть');
		expect(titleOnlineCopy).toBe('Онлайн');
		expect(titleColor).toBe('#F4EFE4');
		expect(titleStroke).toBe('#1A1410');
		expect(titleRowMinWidth).toBe(460);
	});

	it('draws one Phaser plate, not title_btn.png', () => {
		expect(titlePlateW).toBe(224);
		expect(titlePlateH).toBe(48);
		expect(titleBtnFill).toBe('#7A4A28');
		expect(titleBtnStroke).toBe('#1A1410');
		expect(titleBtnHighlight).toBe('#C4B08A');
		expect(titleBtnBase).toBe('#2A1C14');
		expect(titlePressNudge).toBe(2);
		expect(titleOnlineAlpha).toBe(0.45);
	});

	it('picks 9:16 bg when taller than 1.2, else 16:9', () => {
		expect(titlePortraitMinRatio).toBe(1.2);
		expect(titleBgPortrait).toBe('titleBg916');
		expect(titleBgLandscape).toBe('titleBg169');
		expect(pickTitleBgKey(216, 384)).toBe(titleBgPortrait);
		expect(pickTitleBgKey(390, 844)).toBe(titleBgPortrait);
		expect(pickTitleBgKey(384, 216)).toBe(titleBgLandscape);
		expect(pickTitleBgKey(1280, 720)).toBe(titleBgLandscape);
		expect(pickTitleBgKey(100, 120)).toBe(titleBgPortrait);
		expect(pickTitleBgKey(100, 119)).toBe(titleBgLandscape);
	});

	it('covers the view without letterbox (max scale)', () => {
		expect(coverScale(216, 384, 216, 384)).toBe(1);
		expect(coverScale(400, 400, 216, 384)).toBeCloseTo(400 / 216);
		expect(coverScale(800, 200, 384, 216)).toBeCloseTo(800 / 384);
	});
});
