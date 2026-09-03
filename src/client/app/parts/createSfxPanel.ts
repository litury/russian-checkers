import type Phaser from 'phaser';
import { computeFieldLayout } from '@/client/config/fieldLayout';
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
	height: 100,
} as const;

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

const noteX = inset;
const minusX = inset + plate + clusterGap;
const plusX = minusX + plate + clusterGap;
const rowY = inset;
const meterX = inset;
const meterY = rowY + plate + clusterGap;
const meterW = plate * 3 + clusterGap * 2;

let autoMove = true;

type Pointer = {
	worldX?: number;
	worldY?: number;
	id?: number;
};

type PanelHandlers = {
	onOpenChange?: (open: boolean) => void;
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
	glass.setDisplaySize(
		sfxMonitor.width - glassX * 2,
		sfxMonitor.height - glassY * 2,
	);

	const chrome = scene.add.image(0, 0, 'resultMonitor').setOrigin(0, 0);
	chrome.setDepth(panelDepth + 1);
	chrome.setVisible(false);
	chrome.setDisplaySize(sfxMonitor.width, sfxMonitor.height);

	const notePlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0, 0);
	notePlate.setDepth(panelDepth + 2);
	notePlate.setVisible(false);
	notePlate.setDisplaySize(plate, plate);

	const minusPlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0, 0);
	minusPlate.setDepth(panelDepth + 2);
	minusPlate.setVisible(false);
	minusPlate.setDisplaySize(plate, plate);

	const plusPlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0, 0);
	plusPlate.setDepth(panelDepth + 2);
	plusPlate.setVisible(false);
	plusPlate.setDisplaySize(plate, plate);

	const note = scene.add.image(0, 0, noteTexture()).setOrigin(0.5);
	note.setDepth(panelDepth + 3);
	note.setVisible(false);

	const minusGlyph = scene.add
		.text(0, 0, '−', {
			fontFamily: 'monospace',
			fontSize: '28px',
			color: palette.text,
		})
		.setOrigin(0.5)
		.setStroke('#1a1410', 2)
		.setDepth(panelDepth + 3)
		.setVisible(false);

	const plusGlyph = scene.add
		.text(0, 0, '+', {
			fontFamily: 'monospace',
			fontSize: '28px',
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
	let open = false;
	let catcherArmed = false;
	let ignorePointerId: number | undefined;

	type Rest = { x: number; y: number };
	const rest = {
		notePlate: { x: 0, y: 0 } as Rest,
		minusPlate: { x: 0, y: 0 } as Rest,
		plusPlate: { x: 0, y: 0 } as Rest,
		note: { x: 0, y: 0 } as Rest,
		minusGlyph: { x: 0, y: 0 } as Rest,
		plusGlyph: { x: 0, y: 0 } as Rest,
	};

	function insidePanel(x: number, y: number): boolean {
		return (
			x >= px &&
			x <= px + sfxMonitor.width &&
			y >= py &&
			y <= py + sfxMonitor.height
		);
	}

	function paintMeter(): void {
		meter.clear();
		if (!open) {
			return;
		}
		const x = px + glassX + meterX;
		const y = py + glassY + meterY;
		meter.fillStyle(palette.meterTin, 1);
		meter.fillRect(x, y, meterW, meterH);
		meter.fillStyle(palette.meterGold, 1);
		meter.fillRect(x, y, meterW * getSfxMaster(), meterH);
	}

	function paint(): void {
		note.setTexture(noteTexture());
		paintMeter();
	}

	function placeHits(): void {
		chrome.setPosition(px, py);
		glass.setPosition(px + glassX, py + glassY);
		rest.notePlate = {
			x: px + glassX + noteX,
			y: py + glassY + rowY,
		};
		rest.minusPlate = {
			x: px + glassX + minusX,
			y: py + glassY + rowY,
		};
		rest.plusPlate = {
			x: px + glassX + plusX,
			y: py + glassY + rowY,
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
		notePlate.setPosition(rest.notePlate.x, rest.notePlate.y);
		minusPlate.setPosition(rest.minusPlate.x, rest.minusPlate.y);
		plusPlate.setPosition(rest.plusPlate.x, rest.plusPlate.y);
		note.setPosition(rest.note.x, rest.note.y);
		minusGlyph.setPosition(rest.minusGlyph.x, rest.minusGlyph.y);
		plusGlyph.setPosition(rest.plusGlyph.x, rest.plusGlyph.y);
		note.setScale(1, 1);
		minusGlyph.setScale(1, 1);
		plusGlyph.setScale(1, 1);
		paintMeter();
	}

	function armCatcher(): void {
		catcherArmed = true;
	}

	const plates = [notePlate, minusPlate, plusPlate];
	const icons = [note, minusGlyph, plusGlyph];

	function setOpen(next: boolean, pointer?: Pointer): void {
		open = next;
		glass.setVisible(next);
		chrome.setVisible(next);
		meter.setVisible(next);
		for (const img of plates) {
			img.setVisible(next);
		}
		for (const img of icons) {
			img.setVisible(next);
		}
		catcher.setVisible(next);
		if (next) {
			ignorePointerId =
				typeof pointer?.id === 'number' ? pointer.id : undefined;
			catcherArmed = false;
			chrome.setInteractive();
			glass.setInteractive();
			notePlate.setInteractive({ useHandCursor: true });
			note.setInteractive({ useHandCursor: true });
			minusPlate.setInteractive({ useHandCursor: true });
			plusPlate.setInteractive({ useHandCursor: true });
			minusGlyph.setInteractive({ useHandCursor: true });
			plusGlyph.setInteractive({ useHandCursor: true });
			catcher.setInteractive();
			placeHits();
			paint();
			if (typeof scene.time?.delayedCall === 'function') {
				scene.time.delayedCall(0, armCatcher);
			} else {
				armCatcher();
			}
		} else {
			ignorePointerId = undefined;
			catcherArmed = false;
			meter.clear();
			chrome.disableInteractive();
			glass.disableInteractive();
			notePlate.disableInteractive();
			note.disableInteractive();
			minusPlate.disableInteractive();
			plusPlate.disableInteractive();
			minusGlyph.disableInteractive();
			plusGlyph.disableInteractive();
			catcher.disableInteractive();
		}
		handlers.onOpenChange?.(next);
	}

	function toggleMute(): void {
		setSfxMuted(!getSfxMuted());
		paint();
	}

	function bumpMaster(delta: number): void {
		setSfxMaster(getSfxMaster() + delta);
		paint();
	}

	function bindJuice(
		plateGo: Phaser.GameObjects.Image,
		iconGo: Phaser.GameObjects.Image | Phaser.GameObjects.Text,
		plateRest: () => Rest,
		iconRest: () => Rest,
		onDown: () => void,
	): void {
		const down = (): void => {
			const dip = dipPx(plate);
			const pr = plateRest();
			const ir = iconRest();
			plateGo.setPosition(pr.x, pr.y + dip);
			iconGo.setScale(1, 1);
			iconGo.setPosition(ir.x, ir.y + dip);
			onDown();
		};
		const up = (): void => {
			const pr = plateRest();
			const ir = iconRest();
			plateGo.setPosition(pr.x, pr.y);
			iconGo.setScale(1, 1);
			iconGo.setPosition(ir.x, ir.y);
		};
		plateGo.on('pointerdown', down);
		iconGo.on('pointerdown', down);
		plateGo.on('pointerup', up);
		iconGo.on('pointerup', up);
		plateGo.on('pointerout', up);
		iconGo.on('pointerout', up);
	}

	bindJuice(
		notePlate,
		note,
		() => rest.notePlate,
		() => rest.note,
		toggleMute,
	);
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
		layout: (menuX, menuY, width, height) => {
			const field = computeFieldLayout(width, height);
			let x = Math.round(menuX - sfxMonitor.width + layout.hudMenu / 2);
			let y = Math.round(menuY + layout.hudMenu / 2 + pad);
			x = Math.max(pad, Math.min(x, width - pad - sfxMonitor.width));
			if (field.portrait && y + sfxMonitor.height > field.originY) {
				y = Math.round(menuY - sfxMonitor.height / 2);
				x = Math.round(menuX - layout.hudMenu / 2 - pad - sfxMonitor.width);
				x = Math.max(pad, x);
			} else if (y + sfxMonitor.height > height - pad) {
				y = Math.round(menuY - layout.hudMenu / 2 - pad - sfxMonitor.height);
			}
			y = Math.max(pad, y);
			px = x;
			py = y;
			catcher.setPosition(width / 2, height / 2);
			catcher.setDisplaySize(width, height);
			placeHits();
			if (open) {
				paint();
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
