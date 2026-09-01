export const layout = {
	rankCount: 8,
	statusHeight: 52,
	pieceRadiusRatio: 0.34,
	kingMarkRatio: 0.15,
	highlightAlpha: 0.38,
	debugGrid: false,
	pressScale: 0.95,
	pressMs: 90,
	selectMs: 180,
	pulseScaleMin: 1.06,
	pulseScaleMax: 1.14,
	pulseMs: 800,
	moveMs: 180,
	markerFadeMs: 160,
	markerBreathMin: 0.45,
	markerBreathMax: 0.9,
	markerBreathMs: 800,
	shadowAlpha: 0.35,
} as const;

export const tableSprite = {
	key: 'tableBg',
	width: 512,
	height: 512,
	boardX: 128,
	boardY: 128,
	boardW: 256,
	boardH: 256,
	frameX: 96,
	frameY: 96,
	frameW: 320,
	frameH: 320,
} as const;

export const pieceSprites = {
	manLight: 'manLight',
	manDark: 'manDark',
	kingLight: 'kingLight',
	kingDark: 'kingDark',
	size: 64,
	moveRing: 'moveRing',
} as const;
