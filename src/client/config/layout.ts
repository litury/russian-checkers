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
	pitFit: 54 / 64,
	pieceFit: 50 / 64,
} as const;

export const tableLayers = {
	earth: 'earthGrass',
	tile: 64,
} as const;

export const pitSprites = {
	keys: [
		'pitGrass00',
		'pitGrass01',
		'pitGrass02',
		'pitGrass03',
		'pitGrass04',
		'pitGrass05',
		'pitGrass06',
		'pitGrass07',
	] as const,
	size: 64,
} as const;

export const debrisSprites = {
	stonePl: 'debrisStonePl',
	stoneGm: 'debrisStoneGm',
	center: [
		{ key: 'debrisStonePl', visRow: 3, col: 3, texW: 32, texH: 32 },
		{ key: 'debrisStoneGm', visRow: 4, col: 4, texW: 32, texH: 29 },
	] as const,
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
