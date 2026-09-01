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
	liftRatio: 0.06,
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

export const fireSprites = {
	flameLoop: [
		'flameLoop0',
		'flameLoop1',
		'flameLoop2',
		'flameLoop3',
		'flameLoop4',
		'flameLoop5',
		'flameLoop6',
		'flameLoop7',
	] as const,
	flameUp: ['flameUp0', 'flameUp1', 'flameUp2', 'flameUp3'] as const,
	flameLand: ['flameLand0', 'flameLand1', 'flameLand2', 'flameLand3'] as const,
	puffs: ['puff0', 'puff1', 'puff2'] as const,
	ember: 'ember',
} as const;

export const tableBgs = {
	portrait: {
		key: 'bgPhone',
		width: 768,
		height: 1376,
		fieldX: 128,
		fieldY: 432,
		fieldW: 512,
		fieldH: 512,
	},
	landscape: {
		key: 'bgDesk',
		width: 1376,
		height: 768,
		fieldX: 432,
		fieldY: 128,
		fieldW: 512,
		fieldH: 512,
	},
} as const;

export const pitSprites = {
	keys: ['pit00', 'pit03', 'pit07', 'pit10', 'pit11'] as const,
	size: 64,
} as const;

export const pieceSprites = {
	manLight: 'manLight',
	manDark: 'manDark',
	kingLight: 'kingLight',
	kingDark: 'kingDark',
	size: 64,
	selectRim: 'selectRim',
	moveRim: 'moveRim',
	captureRim: 'captureRim',
} as const;
