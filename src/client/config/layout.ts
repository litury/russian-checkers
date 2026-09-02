export const layout = {
	rankCount: 8,
	statusHeight: 52,
	hudBar: 44,
	hudMenu: 44,
	boardBottomGap: 14,
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
	hitStopMs: 50,
	captureBurstMs: 70,
	captureShardCount: 7,
	scorchPitScale: 1.2,
	scorchFadeInMs: 120,
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

export const captureSprites = {
	igniteLight: 'captureIgniteLight',
	igniteDark: 'captureIgniteDark',
	igniteKingLight: 'captureIgniteKingLight',
	igniteKingDark: 'captureIgniteKingDark',
	swellLight: [
		'captureSwellLight0',
		'captureSwellLight1',
		'captureSwellLight2',
	] as const,
	swellDark: [
		'captureSwellDark0',
		'captureSwellDark1',
		'captureSwellDark2',
	] as const,
	swellKingLight: [
		'captureSwellKingLight0',
		'captureSwellKingLight1',
		'captureSwellKingLight2',
	] as const,
	swellKingDark: [
		'captureSwellKingDark0',
		'captureSwellKingDark1',
		'captureSwellKingDark2',
	] as const,
	burstLight: ['captureBurstLight0', 'captureBurstLight1'] as const,
	burstDark: ['captureBurstDark0', 'captureBurstDark1'] as const,
	burstKingLight: ['captureBurstKingLight0', 'captureBurstKingLight1'] as const,
	burstKingDark: ['captureBurstKingDark0', 'captureBurstKingDark1'] as const,
	smolderLight: ['captureSmolderLight0', 'captureSmolderLight1'] as const,
	smolderDark: ['captureSmolderDark0', 'captureSmolderDark1'] as const,
	smolderKingLight: [
		'captureSmolderKingLight0',
		'captureSmolderKingLight1',
	] as const,
	smolderKingDark: [
		'captureSmolderKingDark0',
		'captureSmolderKingDark1',
	] as const,
	flash: [
		'captureFlash0',
		'captureFlash1',
		'captureFlash2',
		'captureFlash3',
	] as const,
	scorch: 'captureScorch',
} as const;

export const fireRing = {
	types: [1, 0, 2, 1, 0, 2, 1] as const,
	anglesDeg: [12, 64, 118, 171, 224, 281, 333] as const,
	wellRatio: 0.86,
	idle: { w: 16, h: 16 },
	up: { w: 12, h: 20 },
	land: { w: 16, h: 12 },
	hopLean: 1,
	hopTrail: 0.22,
	hopRadius: 0.28,
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

export const pathSprites = {
	dash: 'pathDash',
	cross: 'pathCross',
	dashW: 12,
	dashH: 4,
	crossSize: 44,
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
