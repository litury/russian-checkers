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
	if (portrait) {
		const maxField = Math.max(
			0,
			height - layout.hudBar - layout.boardBottomGap,
		);
		const fieldSize = Math.min(width, maxField);
		return {
			portrait: true,
			fieldSize,
			originX: Math.round((width - fieldSize) / 2),
			originY: Math.round(height - layout.boardBottomGap - fieldSize),
			cell: fieldSize / layout.rankCount,
		};
	}
	const fieldSize = Math.min(width, height - layout.boardBottomGap);
	return {
		portrait: false,
		fieldSize,
		originX: Math.round((width - fieldSize) / 2),
		originY: 0,
		cell: fieldSize / layout.rankCount,
	};
}

export function formatClock(totalSec: number): string {
	return String(Math.max(0, Math.floor(totalSec)));
}
