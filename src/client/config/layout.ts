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
	moveMs: 380,
	anticipateMs: 90,
	landHoldMs: 180,
	afterimageMs: 40,
	hopArcRatio: 0.35,
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

export const fireSprites = {
	idle: ['tongue0Idle', 'tongue1Idle', 'tongue2Idle'] as const,
	up: ['tongue0Up', 'tongue1Up', 'tongue2Up'] as const,
	land: ['tongue0Land', 'tongue1Land', 'tongue2Land'] as const,
	puffs: ['puff0', 'puff1', 'puff2'] as const,
	ember: 'ember',
} as const;

export const fireRing = {
	types: [1, 0, 2, 1, 0, 2] as const,
	anglesDeg: [18, 79, 141, 203, 268, 331] as const,
	radiusRatio: 0.9,
	idle: 5,
	up: { w: 8, h: 16 },
	land: { w: 11, h: 6 },
	hopLean: 1,
	hopTrail: 0.38,
	hopRadius: 0.45,
} as const;

export const tableLayers = {
	earth: 'earthGrass',
	tile: 64,
} as const;

export const wreathSprites = {
	mask: 'selectMask',
	spinMs: 10000,
	captureScale: 1.05,
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
