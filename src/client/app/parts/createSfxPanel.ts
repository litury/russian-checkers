import type Phaser from 'phaser';
import { hudFont } from '@/client/fonts/fonts';
import { layout } from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import {
	getSfxMaster,
	getSfxMuted,
	setSfxMaster,
	setSfxMuted,
} from '@/client/modules/sfx/createTableSfx';

export const sfxMonitor = {
	width: 188,
	height: 148,
} as const;

export const resignCopy = 'Сдаться';
export const resignConfirmCopy = 'Точно?';
export const menuPlateKeys = ['hudMenuF0', 'hudMenuF1', 'hudMenuF2'] as const;
export const menuPlateFrameMs = 70;
export const autoStorageKey = 'checkers.autoMove';

const glassX = 16;
const glassY = 12;
const plate = 44;
const inset = 8;
const clusterGap = 4;
const volStep = 0.1;
const meterH = 12;
const catcherDepth = 13;
const panelDepth = 14;
const pad = 8;
const resignW = 140;

const rowY = inset;
const meterX = inset;
const meterY = rowY + plate + clusterGap;
const bottomY = meterY + meterH + clusterGap;

let autoMove = true;

type Pointer = {
	worldX?: number;
	worldY?: number;
	id?: number;
};

type PanelHandlers = {
	onOpenChange?: (open: boolean) => void;
	onResign?: () => void;
};

function readStorage(): Storage | undefined {
	try {
		return globalThis.localStorage;
	} catch {
		return undefined;
	}
}

function loadAutoMove(): void {
	const store = readStorage();
	if (!store) {
		autoMove = true;
		return;
	}
	const raw = store.getItem(autoStorageKey);
	if (raw === '0' || raw === 'false') {
		autoMove = false;
		return;
	}
	autoMove = true;
}

function writeAutoMove(): void {
	const store = readStorage();
	if (!store) {
		return;
	}
	try {
		store.setItem(autoStorageKey, autoMove ? '1' : '0');
	} catch {
		return;
	}
}

loadAutoMove();

export function getAutoMove(): boolean {
	return autoMove;
}

export function setAutoMove(on: boolean): void {
	autoMove = on;
	writeAutoMove();
}

function noteTexture(): string {
	return getSfxMuted() ? 'hudNoteOff' : 'hudNote';
}

function dipPx(size: number): number {
	return Math.round(size * layout.pressDipRatio);
}

export function createSfxPanel(
	scene: Phaser.Scene,
	handlers: PanelHandlers = {},
): {
	layout: (menuX: number, menuY: number, width: number, height: number) => void;
	toggle: (pointer?: Pointer) => void;
	hide: () => void;
	isOpen: () => boolean;
} {
	loadAutoMove();

	const catcher = scene.add.rectangle(0, 0, 16, 16, 0x000000, 0);
	catcher.setDepth(catcherDepth);
	catcher.setVisible(false);

	const glass = scene.add.image(0, 0, 'hudGlassMeadow').setOrigin(0, 0);
	glass.setDepth(panelDepth);
	glass.setVisible(false);

	const chrome = scene.add.image(0, 0, menuPlateKeys[0]).setOrigin(1, 0);
	chrome.setDepth(panelDepth + 1);
	chrome.setVisible(false);

	const minusPlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0, 0);
	minusPlate.setDepth(panelDepth + 2);
	minusPlate.setVisible(false);
	minusPlate.setDisplaySize(plate, plate);

	const plusPlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0, 0);
	plusPlate.setDepth(panelDepth + 2);
	plusPlate.setVisible(false);
	plusPlate.setDisplaySize(plate, plate);

	const minusGlyph = scene.add
		.text(0, 0, '−', {
			fontFamily: hudFont,
			fontSize: '28px',
			color: palette.text,
		})
		.setOrigin(0.5)
		.setStroke('#1a1410', 2)
		.setDepth(panelDepth + 3)
		.setVisible(false);

	const plusGlyph = scene.add
		.text(0, 0, '+', {
			fontFamily: hudFont,
			fontSize: '28px',
			color: palette.text,
		})
		.setOrigin(0.5)
		.setStroke('#1a1410', 2)
		.setDepth(panelDepth + 3)
		.setVisible(false);

	const notePlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0, 0);
	notePlate.setDepth(panelDepth + 2);
	notePlate.setVisible(false);
	notePlate.setDisplaySize(plate, plate);

	const note = scene.add.image(0, 0, noteTexture()).setOrigin(0.5);
	note.setDepth(panelDepth + 3);
	note.setVisible(false);
	note.setDisplaySize(plate, plate);

	const resignPlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0, 0);
	resignPlate.setDepth(panelDepth + 2);
	resignPlate.setVisible(false);
	resignPlate.setDisplaySize(resignW, plate);

	const resignGlyph = scene.add
		.text(0, 0, resignCopy, {
			fontFamily: hudFont,
			fontSize: '18px',
			color: palette.text,
		})
		.setOrigin(0.5)
		.setStroke('#1a1410', 2)
		.setDepth(panelDepth + 3)
		.setVisible(false);

	const meter = scene.add.graphics();
	meter.setDepth(panelDepth + 2);
	meter.setVisible(false);

	let px = 0;
	let py = 0;
	let panelW = 0;
	let menuX = 0;
	let menuY = 0;
	let open = false;
	let catcherArmed = false;
	let ignorePointerId: number | undefined;
	let resignArmed = false;

	type Rest = { x: number; y: number };
	const rest = {
		minusPlate: { x: 0, y: 0 } as Rest,
		plusPlate: { x: 0, y: 0 } as Rest,
		minusGlyph: { x: 0, y: 0 } as Rest,
		plusGlyph: { x: 0, y: 0 } as Rest,
		notePlate: { x: 0, y: 0 } as Rest,
		note: { x: 0, y: 0 } as Rest,
		resignPlate: { x: 0, y: 0 } as Rest,
		resignGlyph: { x: 0, y: 0 } as Rest,
	};

	function insidePanel(x: number, y: number): boolean {
		return (
			x >= px &&
			x <= px + sfxMonitor.width &&
			y >= py &&
			y <= py + sfxMonitor.height
		);
	}

	function meterW(): number {
		return plate * 3 + clusterGap * 2;
	}

	function paintMeter(): void {
		meter.clear();
		if (!open) {
			return;
		}
		const x = px + glassX + meterX;
		const y = py + glassY + meterY;
		const w = meterW();
		meter.fillStyle(palette.meterTin, 1);
		meter.fillRect(x, y, w, meterH);
		meter.fillStyle(palette.meterGold, 1);
		meter.fillRect(x, y, w * getSfxMaster(), meterH);
	}

	function paintNote(): void {
		note.setTexture(noteTexture());
		note.setScale(1, 1);
		note.setDisplaySize(plate, plate);
	}

	function paintResign(): void {
		resignGlyph.setText(resignArmed ? resignConfirmCopy : resignCopy);
	}

	function paint(): void {
		paintNote();
		paintMeter();
		paintResign();
	}

	function fromScale(): number {
		return layout.hudMenu / sfxMonitor.width;
	}

	function sizeChrome(scale: number): void {
		chrome.setScale(scale, scale);
		chrome.setDisplaySize(panelW * scale, sfxMonitor.height * scale);
	}

	function placeHits(): void {
		const cornerX = menuX - layout.hudMenu / 2;
		const cornerY = menuY + layout.hudMenu / 2;
		chrome.setOrigin(1, 0);
		chrome.setPosition(cornerX, cornerY);
		sizeChrome(open ? 1 : fromScale());
		glass.setPosition(px + glassX, py + glassY);
		glass.setDisplaySize(
			Math.max(1, panelW - glassX * 2),
			sfxMonitor.height - glassY * 2,
		);
		rest.notePlate = {
			x: px + glassX + inset,
			y: py + glassY + rowY,
		};
		rest.minusPlate = {
			x: rest.notePlate.x + plate + clusterGap,
			y: rest.notePlate.y,
		};
		rest.plusPlate = {
			x: rest.minusPlate.x + plate + clusterGap,
			y: rest.notePlate.y,
		};
		rest.note = {
			x: rest.notePlate.x + plate / 2,
			y: rest.notePlate.y + plate / 2,
		};
		rest.minusGlyph = {
			x: rest.minusPlate.x + plate / 2,
			y: rest.minusPlate.y + plate / 2,
		};
		rest.plusGlyph = {
			x: rest.plusPlate.x + plate / 2,
			y: rest.plusPlate.y + plate / 2,
		};
		rest.resignPlate = {
			x: px + glassX + inset,
			y: py + glassY + bottomY,
		};
		rest.resignGlyph = {
			x: rest.resignPlate.x + resignW / 2,
			y: rest.resignPlate.y + plate / 2,
		};
		minusPlate.setPosition(rest.minusPlate.x, rest.minusPlate.y);
		plusPlate.setPosition(rest.plusPlate.x, rest.plusPlate.y);
		minusGlyph.setPosition(rest.minusGlyph.x, rest.minusGlyph.y);
		plusGlyph.setPosition(rest.plusGlyph.x, rest.plusGlyph.y);
		notePlate.setPosition(rest.notePlate.x, rest.notePlate.y);
		note.setPosition(rest.note.x, rest.note.y);
		resignPlate.setPosition(rest.resignPlate.x, rest.resignPlate.y);
		resignPlate.setDisplaySize(resignW, plate);
		resignGlyph.setPosition(rest.resignGlyph.x, rest.resignGlyph.y);
		minusGlyph.setScale(1, 1);
		plusGlyph.setScale(1, 1);
		paintNote();
		paintMeter();
	}

	function armCatcher(): void {
		catcherArmed = true;
	}

	const plates = [minusPlate, plusPlate, notePlate, resignPlate];
	const icons = [minusGlyph, plusGlyph, note, resignGlyph];

	function prefersReducedMotion(): boolean {
		try {
			return Boolean(
				globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
			);
		} catch {
			return false;
		}
	}

	let plateTimer: { remove?: (dispatch?: boolean) => void } | undefined;

	function clearPlateTimer(): void {
		plateTimer?.remove?.(false);
		plateTimer = undefined;
	}

	function setControlsVisible(on: boolean): void {
		glass.setVisible(on);
		meter.setVisible(on);
		for (const img of plates) {
			img.setVisible(on);
		}
		for (const img of icons) {
			img.setVisible(on);
		}
	}

	function setOpen(next: boolean, pointer?: Pointer): void {
		open = next;
		clearPlateTimer();
		catcher.setVisible(next);
		if (next) {
			ignorePointerId =
				typeof pointer?.id === 'number' ? pointer.id : undefined;
			catcherArmed = false;
			chrome.setVisible(true);
			chrome.setTexture(menuPlateKeys[0]);
			sizeChrome(fromScale());
			setControlsVisible(false);
			placeHits();
			sizeChrome(fromScale());
			const finishOpen = (): void => {
				chrome.setTexture(menuPlateKeys[2]);
				sizeChrome(1);
				setControlsVisible(true);
				minusPlate.setInteractive({ useHandCursor: true });
				plusPlate.setInteractive({ useHandCursor: true });
				notePlate.setInteractive({ useHandCursor: true });
				resignPlate.setInteractive({ useHandCursor: true });
				catcher.setInteractive();
				paint();
				if (typeof scene.time?.delayedCall === 'function') {
					scene.time.delayedCall(0, armCatcher);
				} else {
					armCatcher();
				}
			};
			if (
				prefersReducedMotion() ||
				typeof scene.time?.delayedCall !== 'function'
			) {
				finishOpen();
			} else {
				plateTimer = scene.time.delayedCall(menuPlateFrameMs, () => {
					chrome.setTexture(menuPlateKeys[1]);
					const mid = (fromScale() + 1) / 2;
					sizeChrome(mid);
					plateTimer = scene.time.delayedCall(menuPlateFrameMs, () => {
						finishOpen();
					});
				});
			}
		} else {
			ignorePointerId = undefined;
			catcherArmed = false;
			meter.clear();
			minusPlate.disableInteractive();
			plusPlate.disableInteractive();
			notePlate.disableInteractive();
			resignPlate.disableInteractive();
			catcher.disableInteractive();
			resignArmed = false;
			paintResign();
			setControlsVisible(false);
			const finishClose = (): void => {
				chrome.setVisible(false);
				sizeChrome(fromScale());
			};
			if (
				!chrome.visible ||
				prefersReducedMotion() ||
				typeof scene.time?.delayedCall !== 'function'
			) {
				finishClose();
			} else {
				chrome.setTexture(menuPlateKeys[2]);
				chrome.setVisible(true);
				const mid = (fromScale() + 1) / 2;
				sizeChrome(mid);
				plateTimer = scene.time.delayedCall(menuPlateFrameMs, () => {
					chrome.setTexture(menuPlateKeys[1]);
					sizeChrome(mid);
					plateTimer = scene.time.delayedCall(menuPlateFrameMs, () => {
						chrome.setTexture(menuPlateKeys[0]);
						sizeChrome(fromScale());
						plateTimer = scene.time.delayedCall(menuPlateFrameMs, () => {
							finishClose();
						});
					});
				});
			}
		}
		handlers.onOpenChange?.(next);
	}

	function toggleMute(): void {
		setSfxMuted(!getSfxMuted());
		paint();
	}

	function bumpMaster(delta: number): void {
		if (getSfxMuted()) {
			return;
		}
		setSfxMaster(getSfxMaster() + delta);
		paint();
	}

	function bindJuice(
		plateGo: Phaser.GameObjects.Image,
		iconGo: Phaser.GameObjects.Image | Phaser.GameObjects.Text,
		plateRest: () => Rest,
		iconRest: () => Rest,
		onDown: () => void,
		plateWidth = plate,
	): void {
		const down = (): void => {
			const dip = dipPx(plate);
			const pr = plateRest();
			const ir = iconRest();
			plateGo.setPosition(pr.x, pr.y + dip);
			iconGo.setScale(1, 1);
			iconGo.setPosition(ir.x, ir.y + dip);
			if (iconGo === note) {
				note.setDisplaySize(plate, plate);
			}
			onDown();
		};
		const up = (): void => {
			const pr = plateRest();
			const ir = iconRest();
			plateGo.setPosition(pr.x, pr.y);
			iconGo.setScale(1, 1);
			iconGo.setPosition(ir.x, ir.y);
			if (iconGo === note) {
				note.setDisplaySize(plate, plate);
			}
			plateGo.setDisplaySize(plateWidth, plate);
		};
		plateGo.on('pointerdown', down);
		plateGo.on('pointerup', up);
		plateGo.on('pointerout', up);
	}

	bindJuice(
		minusPlate,
		minusGlyph,
		() => rest.minusPlate,
		() => rest.minusGlyph,
		() => {
			bumpMaster(-volStep);
		},
	);
	bindJuice(
		plusPlate,
		plusGlyph,
		() => rest.plusPlate,
		() => rest.plusGlyph,
		() => {
			bumpMaster(volStep);
		},
	);
	bindJuice(
		notePlate,
		note,
		() => rest.notePlate,
		() => rest.note,
		toggleMute,
	);
	bindJuice(
		resignPlate,
		resignGlyph,
		() => rest.resignPlate,
		() => rest.resignGlyph,
		() => {
			if (!resignArmed) {
				resignArmed = true;
				paintResign();
				return;
			}
			resignArmed = false;
			handlers.onResign?.();
			setOpen(false);
		},
		resignW,
	);
	catcher.on('pointerdown', (pointer: Pointer) => {
		if (!catcherArmed) {
			return;
		}
		if (ignorePointerId !== undefined && pointer.id === ignorePointerId) {
			return;
		}
		if (insidePanel(pointer.worldX ?? 0, pointer.worldY ?? 0)) {
			return;
		}
		setOpen(false);
	});

	return {
		layout: (anchorX, anchorY, width, height) => {
			menuX = anchorX;
			menuY = anchorY;
			panelW = sfxMonitor.width;
			px = Math.round(anchorX - layout.hudMenu / 2 - sfxMonitor.width);
			py = Math.round(anchorY + layout.hudMenu / 2);
			catcher.setPosition(width / 2, height / 2);
			catcher.setDisplaySize(width, height);
			placeHits();
			if (open) {
				sizeChrome(1);
				paint();
			} else {
				sizeChrome(fromScale());
			}
		},
		toggle: (pointer) => {
			setOpen(!open, pointer);
		},
		hide: () => {
			setOpen(false);
		},
		isOpen: () => open,
	};
}
