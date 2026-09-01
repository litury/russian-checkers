export const layout = {
	rankCount: 8,
	statusHeight: 52,
	pieceRadiusRatio: 0.34,
	kingMarkRatio: 0.15,
	highlightAlpha: 0.38,
	debugGrid: false,
	pressScaleY: 0.85,
	pressDipRatio: 0.05,
	pressMs: 140,
	liftRatio: 0.12,
	selectMs: 180,
	moveMs: 180,
	markerFadeMs: 160,
	markerBreathMin: 0.45,
	markerBreathMax: 0.9,
	markerBreathMs: 800,
	shadowAlpha: 0.35,
	minCellPx: 44,
	framePadPx: 12,
} as const;

export const boardSprite = {
	key: 'board8',
	width: 512,
	height: 512,
} as const;

export const tableBgs = {
	portrait: {
		key: 'bg916',
		width: 384,
		height: 688,
		holeX: 98,
		holeY: 251,
		holeW: 187,
		holeH: 188,
	},
	landscape: {
		key: 'bg169',
		width: 688,
		height: 384,
		holeX: 248,
		holeY: 94,
		holeW: 194,
		holeH: 194,
	},
} as const;

export const pieceSprites = {
	manLight: 'manLight',
	manDark: 'manDark',
	kingLight: 'kingLight',
	kingDark: 'kingDark',
	size: 64,
	moveRing: 'moveRing',
	selectRing: 'selectRing',
} as const;
