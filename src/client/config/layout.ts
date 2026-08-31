export const layout = {
	rankCount: 8,
	statusHeight: 52,
	pieceRadiusRatio: 0.34,
	kingMarkRatio: 0.15,
	highlightAlpha: 0.38,
	debugGrid: false,
} as const;

export const tableSprite = {
	key: 'tableBg',
	width: 1280,
	height: 1280,
	boardX: 316,
	boardY: 328,
	boardW: 656,
	boardH: 650,
	frameX: 259,
	frameY: 275,
	frameW: 768,
	frameH: 771,
} as const;

export const pieceSprites = {
	manLight: 'manLight',
	manDark: 'manDark',
	kingLight: 'kingLight',
	kingDark: 'kingDark',
	size: 64,
} as const;
