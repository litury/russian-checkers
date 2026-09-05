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

export function formatClock(totalSec: number): string {
	const sec = Math.max(0, Math.floor(totalSec));
	const minutes = Math.floor(sec / 60);
	const seconds = sec % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
