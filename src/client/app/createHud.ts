import type Phaser from 'phaser';
import {
	clockFontPx,
	hudFont,
	nameFontPx,
	whenHudFontReady,
} from '@/client/fonts/fonts';
import {
	clockHudLayout,
	computeFieldLayout,
	formatClock,
	hudClockEH,
	hudClockEW,
} from '@/client/config/fieldLayout';
import { palette } from '@/client/config/palette';
import { blitzStartMs, type Side } from '@/rules';

export const hudClockEIdleKey = 'hudClockEIdle';
export const hudClockEHotKey = 'hudClockEHot';
export const hudClockEHot1Key = 'hudClockEHot1';
export const hudClockEHot2Key = 'hudClockEHot2';
export const hudClockEOkKey = 'hudClockEOk';
export const hudClockEOk1Key = 'hudClockEOk1';
export const hudClockEOk2Key = 'hudClockEOk2';
export const hudClockLampMs = 140;
export const hudNamePlankKey = 'hudNamePlank';
export const hudClockGrassKey = 'hudClockGrass';
export const hudClockGrassKeys = [
	'hudClockGrass',
	'hudClockGrass1',
	'hudClockGrass2',
	'hudClockGrass3',
] as const;
export const hudClockGrassWindMs = 780;
export const hudClockGrassYouWindMs = 1100;
export const hudClockGrassSize = 150;
export const hudNamePlankW = 160;
export const hudNamePlankH = 128;
export const hudNamePlankNativeW = 160;
export const hudNamePlankNativeH = 80;
export const hudNamePlankTextNativeY = 22;
export const hudClockGrassDropPx = 4;
export const hudNameMaxChars = 12;

export function clipPlayerName(raw: string): string {
	const chars = Array.from(raw.trim());
	if (chars.length <= hudNameMaxChars) {
		return chars.join('');
	}
	return `${chars.slice(0, hudNameMaxChars - 1).join('')}…`;
}
export { hudClockEW, hudClockEH } from '@/client/config/fieldLayout';
export const hudClockFaceKey = 'hudClockFace';
export const hudClockFaceSize = 96;
export const hudClockHubDx = 4;
export const hudClockHubDy = 2;
export const hudClockWellR = 22;
export const hudClockTicks = 3;
export const hudClockMarks = 12;
export const hudClockNeedle = 0xa68e63;

const textStroke = '#1a1410';
const hudDepth = 12;
const plankDepth = 10;
const grassDepth = 13;
const clockDigitDepth = 14;
const nameDepth = 15;

type HudHandlers = {
	onResign?: () => void;
	onAutoChange?: () => void;
};


function prefersReducedMotion(): boolean {
	try {
		return Boolean(
			globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
		);
	} catch {
		return false;
	}
}

function hudText(
	scene: Phaser.Scene,
	content: string,
	fontSize: string,
): Phaser.GameObjects.Text {
	return scene.add
		.text(0, 0, content, {
			fontFamily: hudFont,
			fontSize,
			color: palette.text,
		})
		.setStroke(textStroke, 2)
		.setDepth(hudDepth);
}

export function createHud(
	scene: Phaser.Scene,
	handlers: HudHandlers = {},
): {
	isMenuOpen: () => boolean;
	layout: (width: number, height: number) => void;
	setTurn: (copy: string) => void;
	setTimer: (elapsedSec: number) => void;
	setClock: (whiteSec: number, blackSec: number, turn?: Side | null) => void;
	setHand: (remainingMs: number, lap?: number) => void;
	setVisible: (on: boolean) => void;
	setNames: (you: string, foe: string) => void;
} {
	const face = scene.add
		.image(0, 0, hudClockFaceKey)
		.setOrigin(0.5)
		.setDisplaySize(hudClockFaceSize, hudClockFaceSize)
		.setDepth(hudDepth);
	const needle = scene.add.graphics();
	needle.setDepth(hudDepth + 1);
	face.setVisible(false);
	needle.setVisible(false);
	const foeShell = scene.add
		.image(0, 0, hudClockEIdleKey)
		.setOrigin(0, 1)
		.setDisplaySize(hudClockEW, hudClockEH)
		.setDepth(hudDepth);
	const youShell = scene.add
		.image(0, 0, hudClockEIdleKey)
		.setOrigin(1, 1)
		.setDisplaySize(hudClockEW, hudClockEH)
		.setDepth(hudDepth);
	type LampKind = 'idle' | 'ok' | 'hot';
	type LampFrame = 0 | 1 | 2;
	type LampPose = { kind: LampKind; frame: LampFrame };
	let youLamp: LampPose = { kind: 'idle', frame: 0 };
	let foeLamp: LampPose = { kind: 'idle', frame: 0 };
	let lastTurn: Side | null | undefined;
	let youQueue: LampPose[] = [];
	let foeQueue: LampPose[] = [];
	let lampTimer: { remove: (dispatch?: boolean) => void } | undefined;
	const okLampKeys = [
		hudClockEOkKey,
		hudClockEOk1Key,
		hudClockEOk2Key,
	] as const;
	const hotLampKeys = [
		hudClockEHotKey,
		hudClockEHot1Key,
		hudClockEHot2Key,
	] as const;

	function lampTexture(pose: LampPose): string {
		if (pose.kind === 'idle') {
			return hudClockEIdleKey;
		}
		const keys = pose.kind === 'ok' ? okLampKeys : hotLampKeys;
		return keys[pose.frame] ?? keys[0];
	}

	function paintLampShells(): void {
		youShell.setTexture(lampTexture(youLamp));
		foeShell.setTexture(lampTexture(foeLamp));
		youShell.setDisplaySize(hudClockEW, hudClockEH);
		foeShell.setDisplaySize(hudClockEW, hudClockEH);
	}

	function stopLamps(): void {
		lampTimer?.remove(false);
		lampTimer = undefined;
		youQueue = [];
		foeQueue = [];
	}

	function holdFor(turn: Side): { you: LampPose; foe: LampPose } {
		if (turn === 'white') {
			return {
				you: { kind: 'ok', frame: 2 },
				foe: { kind: 'hot', frame: 0 },
			};
		}
		return {
			you: { kind: 'hot', frame: 0 },
			foe: { kind: 'ok', frame: 2 },
		};
	}

	function dimOut(kind: 'ok' | 'hot', from: LampFrame): LampPose[] {
		const out: LampPose[] = [];
		for (let frame = from; frame >= 0; frame -= 1) {
			out.push({ kind, frame: frame as LampFrame });
		}
		return out;
	}

	function lightUp(): LampPose[] {
		return [
			{ kind: 'ok', frame: 0 },
			{ kind: 'ok', frame: 1 },
			{ kind: 'ok', frame: 2 },
		];
	}

	function tickLamps(): void {
		if (youQueue.length > 0) {
			youLamp = youQueue.shift() ?? youLamp;
		}
		if (foeQueue.length > 0) {
			foeLamp = foeQueue.shift() ?? foeLamp;
		}
		paintLampShells();
		if (youQueue.length === 0 && foeQueue.length === 0) {
			lampTimer = undefined;
			return;
		}
		lampTimer = scene.time.delayedCall(hudClockLampMs, tickLamps);
	}

	function playQueues(): void {
		if (youQueue.length === 0 && foeQueue.length === 0) {
			paintLampShells();
			return;
		}
		lampTimer?.remove(false);
		tickLamps();
	}

	function applyTurn(turn: Side | null): void {
		if (turn === lastTurn) {
			return;
		}
		const prev = lastTurn;
		lastTurn = turn;
		stopLamps();
		if (!turn) {
			youLamp = { kind: 'hot', frame: 0 };
			foeLamp = { kind: 'hot', frame: 0 };
			paintLampShells();
			return;
		}
		const hold = holdFor(turn);
		if (prev === undefined || prev === null || prefersReducedMotion()) {
			youLamp = hold.you;
			foeLamp = hold.foe;
			paintLampShells();
			return;
		}
		const leavingYou = prev === 'white';
		youQueue = leavingYou
			? [...dimOut('ok', youLamp.frame), { kind: 'hot', frame: 0 }]
			: [
					...dimOut('hot', youLamp.frame === 0 ? 1 : youLamp.frame),
					...lightUp(),
				];
		foeQueue = leavingYou
			? [
					...dimOut('hot', foeLamp.frame === 0 ? 1 : foeLamp.frame),
					...lightUp(),
				]
			: [...dimOut('ok', foeLamp.frame), { kind: 'hot', frame: 0 }];
		playQueues();
	}
	const foePlank = scene.add
		.image(0, 0, hudNamePlankKey)
		.setOrigin(0.5, 1)
		.setDisplaySize(hudNamePlankW, hudNamePlankH)
		.setDepth(plankDepth);
	const youPlank = scene.add
		.image(0, 0, hudNamePlankKey)
		.setOrigin(0.5, 1)
		.setFlipX(true)
		.setDisplaySize(hudNamePlankW, hudNamePlankH)
		.setDepth(plankDepth);
	const clockStyle = {
		fontFamily: hudFont,
		fontSize: `${clockFontPx}px`,
		color: palette.text,
	};
	const foeGrass = scene.add
		.image(0, 0, hudClockGrassKey)
		.setOrigin(0.5, 1)
		.setDisplaySize(hudClockGrassSize, hudClockGrassSize)
		.setDepth(grassDepth);
	const youGrass = scene.add
		.image(0, 0, hudClockGrassKeys[2])
		.setOrigin(0.5, 1)
		.setFlipX(true)
		.setDisplaySize(hudClockGrassSize, hudClockGrassSize)
		.setDepth(grassDepth);
	if (!prefersReducedMotion() && typeof scene.time?.addEvent === 'function') {
		const ping = [0, 1, 2, 1] as const;
		const loopGrass = (
			sprite: Phaser.GameObjects.Image,
			start: number,
			delay: number,
			reverse: boolean,
		): void => {
			let step = start % ping.length;
			scene.time.addEvent({
				delay,
				loop: true,
				callback: () => {
					step = reverse
						? (step + ping.length - 1) % ping.length
						: (step + 1) % ping.length;
					sprite.setTexture(hudClockGrassKeys[ping[step]]);
				},
			});
		};
		loopGrass(foeGrass, 0, hudClockGrassWindMs, false);
		loopGrass(youGrass, 2, hudClockGrassYouWindMs, true);
	}
	const foeClock = scene.add
		.text(0, 0, '', clockStyle)
		.setOrigin(0.5)
		.setDepth(clockDigitDepth)
		.setVisible(false);
	const youClock = scene.add
		.text(0, 0, '', clockStyle)
		.setOrigin(0.5)
		.setDepth(clockDigitDepth)
		.setVisible(false);
	const labelStyle = {
		fontFamily: hudFont,
		fontSize: `${nameFontPx}px`,
		color: palette.text,
	};
	const foeLabel = scene.add
		.text(0, 0, 'Бот', labelStyle)
		.setOrigin(0.5, 0.5)
		.setDepth(nameDepth)
		.setVisible(false);
	const youLabel = scene.add
		.text(0, 0, 'Ты', labelStyle)
		.setOrigin(0.5, 0.5)
		.setDepth(nameDepth)
		.setVisible(false);
	let clockFontReady = false;
	whenHudFontReady(() => {
		clockFontReady = true;
		foeClock.setFontFamily(hudFont);
		youClock.setFontFamily(hudFont);
		foeLabel.setFontFamily(hudFont);
		youLabel.setFontFamily(hudFont);
		foeClock.setFontSize(clockFontPx);
		youClock.setFontSize(clockFontPx);
		foeClock.setText(foeClock.text || '60');
		youClock.setText(youClock.text || '60');
		foeClock.setVisible(true);
		youClock.setVisible(true);
		foeLabel.setVisible(true);
		youLabel.setVisible(true);
	});
	let hubX = 0;
	let hubY = 0;
	const turn = hudText(scene, '', '16px');
	turn.setVisible(false);
	const autoChanged = (event: Event) => {
		if ((event as CustomEvent).detail?.autoMove !== undefined)
			handlers.onAutoChange?.();
	};
	if (typeof window !== 'undefined') {
		window.addEventListener('checkers-settings-change', autoChanged);
		scene.events.once('shutdown', () =>
			window.removeEventListener('checkers-settings-change', autoChanged),
		);
	}
	let handLap = 0;

	function paintHand(remainingMs: number, lap = handLap): void {
		handLap = lap;
		const t =
			1 - Math.max(0, Math.min(blitzStartMs, remainingMs)) / blitzStartMs;
		const sweep = (hudClockTicks * Math.PI * 2) / hudClockMarks;
		const angle = -Math.PI / 2 + (handLap + t) * sweep;
		const tipX = hubX + Math.cos(angle) * hudClockWellR;
		const tipY = hubY + Math.sin(angle) * hudClockWellR;
		needle.clear();
		needle.lineStyle(2, hudClockNeedle, 1);
		needle.lineBetween(hubX, hubY, tipX, tipY);
	}

	function setHudVisible(on: boolean): void {
		face.setVisible(false);
		needle.setVisible(false);
		foeClock.setVisible(on && clockFontReady);
		youClock.setVisible(on && clockFontReady);
		foeLabel.setVisible(on && clockFontReady);
		youLabel.setVisible(on && clockFontReady);
		foePlank.setVisible(on);
		youPlank.setVisible(on);
		foeGrass.setVisible(on);
		youGrass.setVisible(on);
		foeShell.setVisible(on);
		youShell.setVisible(on);
		turn.setVisible(false);
		if (!on) stopLamps();
	}

	return {
		isMenuOpen: () => false,
		layout: (width, height) => {
			const field = computeFieldLayout(width, height);
			face.setVisible(false);
			needle.setVisible(false);
			const clocks = clockHudLayout(width, height, field);
			foeShell.setOrigin(clocks.foe.originX, clocks.foe.originY);
			youShell.setOrigin(clocks.you.originX, clocks.you.originY);
			foeShell.setPosition(clocks.foe.x, clocks.foe.y);
			youShell.setPosition(clocks.you.x, clocks.you.y);
			foeShell.setDisplaySize(hudClockEW, hudClockEH);
			youShell.setDisplaySize(hudClockEW, hudClockEH);
			foeClock.setPosition(clocks.foeDigit.x, clocks.foeDigit.y);
			youClock.setPosition(clocks.youDigit.x, clocks.youDigit.y);
			const foeLeft = clocks.foe.x - clocks.foe.originX * hudClockEW;
			const foeTop = clocks.foe.y - clocks.foe.originY * hudClockEH;
			const youLeft = clocks.you.x - clocks.you.originX * hudClockEW;
			const youTop = clocks.you.y - clocks.you.originY * hudClockEH;
			const foeCx = foeLeft + hudClockEW / 2;
			const youCx = youLeft + hudClockEW / 2;
			const foeBottom = foeTop + hudClockEH;
			const youBottom = youTop + hudClockEH;
			const foePlankBottom = foeBottom;
			const youPlankBottom = youBottom;
			const nameY = (h: number, bottom: number): number =>
				bottom - h + (h * hudNamePlankTextNativeY) / hudNamePlankNativeH;
			foePlank.setPosition(foeCx, foePlankBottom);
			youPlank.setPosition(youCx, youPlankBottom);
			foePlank.setDisplaySize(hudNamePlankW, hudNamePlankH);
			youPlank.setDisplaySize(hudNamePlankW, hudNamePlankH);
			foeGrass.setPosition(foeCx, foeBottom + hudClockGrassDropPx);
			youGrass.setPosition(youCx, youBottom + hudClockGrassDropPx);
			foeGrass.setDisplaySize(hudClockGrassSize, hudClockGrassSize);
			youGrass.setDisplaySize(hudClockGrassSize, hudClockGrassSize);
			foeLabel.setPosition(foeCx, nameY(hudNamePlankH, foePlankBottom));
			youLabel.setPosition(youCx, nameY(hudNamePlankH, youPlankBottom));

		},
		setTurn: (copy) => {
			turn.setText('');
			void copy;
		},
		setTimer: (_elapsedSec) => {},
		setClock: (whiteSec, blackSec, turn = 'white') => {
			youClock.setText(formatClock(whiteSec));
			foeClock.setText(formatClock(blackSec));
			applyTurn(turn ?? null);
		},
		setHand: (remainingMs, lap = 0) => {
			paintHand(remainingMs, lap);
		},
		setVisible: (on) => {
			setHudVisible(on);
		},
		setNames: (you, foe) => {
			youLabel.setText(clipPlayerName(you) || 'Ты');
			foeLabel.setText(clipPlayerName(foe) || 'Бот');
		},
	};
}
