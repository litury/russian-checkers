import { layout } from '@/client/config/layout';

export type FieldLayout = {
	portrait: boolean;
	fieldSize: number;
	originX: number;
	originY: number;
	cell: number;
};

export function computeFieldLayout(width: number, height: number): FieldLayout {
	const portrait = height > width;
	const topGap = layout.hudBar + 24;
	const maxField = Math.max(0, height - topGap - layout.boardBottomGap);
	const fieldSize = Math.min(width, maxField);
	return {
		portrait,
		fieldSize,
		originX: Math.round((width - fieldSize) / 2),
		originY: Math.round(height - layout.boardBottomGap - fieldSize),
		cell: fieldSize / layout.rankCount,
	};
}

export const hudClockNativeW = 64;
export const hudClockNativeH = 40;
export const hudClockEW = 112;
export const hudClockEH = 70;
export const hudClockSafeInset = 16;
export const hudClockSideGap = 8;
export const hudClockEWellNativeX = 40;
export const hudClockEWellNativeY = 26;
export const hudClockEWellX = Math.round((hudClockEW * hudClockEWellNativeX) / hudClockNativeW);
export const hudClockEWellY = Math.round((hudClockEH * hudClockEWellNativeY) / hudClockNativeH);

export type ClockAnchor = {
	x: number;
	y: number;
	originX: number;
	originY: number;
};

export type ClockHudLayout = {
	foe: ClockAnchor;
	you: ClockAnchor;
	foeDigit: { x: number; y: number };
	youDigit: { x: number; y: number };
	foeLabel: { x: number; y: number };
	youLabel: { x: number; y: number };
};

function digitAt(anchor: ClockAnchor): { x: number; y: number } {
	const left = anchor.x - anchor.originX * hudClockEW;
	const top = anchor.y - anchor.originY * hudClockEH;
	return { x: left + hudClockEWellX, y: top + hudClockEWellY };
}

function labelAt(anchor: ClockAnchor): { x: number; y: number } {
	const left = anchor.x - anchor.originX * hudClockEW;
	const top = anchor.y - anchor.originY * hudClockEH;
	return { x: left + hudClockEW / 2, y: top - 4 };
}

export function clockHudLayout(
	width: number,
	_height: number,
	field: FieldLayout,
): ClockHudLayout {
	if (field.portrait) {
		const foe: ClockAnchor = {
			x: hudClockSafeInset,
			y: field.originY,
			originX: 0,
			originY: 1,
		};
		const you: ClockAnchor = {
			x: width - hudClockSafeInset,
			y: field.originY,
			originX: 1,
			originY: 1,
		};
		return {
			foe,
			you,
			foeDigit: digitAt(foe),
			youDigit: digitAt(you),
			foeLabel: labelAt(foe),
			youLabel: labelAt(you),
		};
	}
	const midY = field.originY + field.fieldSize / 2;
	const foe: ClockAnchor = {
		x: field.originX - hudClockSideGap,
		y: midY,
		originX: 1,
		originY: 0.5,
	};
	const you: ClockAnchor = {
		x: field.originX + field.fieldSize + hudClockSideGap,
		y: midY,
		originX: 0,
		originY: 0.5,
	};
	return {
		foe,
		you,
		foeDigit: digitAt(foe),
		youDigit: digitAt(you),
		foeLabel: labelAt(foe),
		youLabel: labelAt(you),
	};
}

export function formatClock(totalSec: number): string {
	return `${Math.max(0, Math.floor(totalSec))}`;
}
