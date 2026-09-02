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
	height: 84,
} as const;

export const autoStorageKey = 'checkers.autoMove';
export const musicStorageKey = 'checkers.musicMuted';

const glassX = 16;
const glassY = 12;
const plate = 44;
const inset = 8;
const clusterGap = 4;
const volStep = 0.1;
const catcherDepth = 13;
const panelDepth = 14;
const pad = 8;

const noteX = inset;
const minusX = inset + plate + clusterGap;
const plusX = minusX + plate + clusterGap;
const rowY = inset;

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

	let px = 0;
	let py = 0;
	let open = false;
	let catcherArmed = false;
	let ignorePointerId: number | undefined;

	function insidePanel(x: number, y: number): boolean {
		return (
			x >= px &&
			x <= px + sfxMonitor.width &&
			y >= py &&
			y <= py + sfxMonitor.height
		);
	}

	function paint(): void {
		note.setTexture(noteTexture());
	}

	function placeHits(): void {
		chrome.setPosition(px, py);
		glass.setPosition(px + glassX, py + glassY);
		notePlate.setPosition(px + glassX + noteX, py + glassY + rowY);
		minusPlate.setPosition(px + glassX + minusX, py + glassY + rowY);
		plusPlate.setPosition(px + glassX + plusX, py + glassY + rowY);
		note.setPosition(
			px + glassX + noteX + plate / 2,
			py + glassY + rowY + plate / 2,
		);
		minusGlyph.setPosition(
			px + glassX + minusX + plate / 2,
			py + glassY + rowY + plate / 2,
		);
		plusGlyph.setPosition(
			px + glassX + plusX + plate / 2,
			py + glassY + rowY + plate / 2,
		);
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
			note.setInteractive({ useHandCursor: true });
			minusPlate.setInteractive({ useHandCursor: true });
			plusPlate.setInteractive({ useHandCursor: true });
			minusGlyph.setInteractive({ useHandCursor: true });
			plusGlyph.setInteractive({ useHandCursor: true });
			catcher.setInteractive();
			paint();
			if (typeof scene.time?.delayedCall === 'function') {
				scene.time.delayedCall(0, armCatcher);
			} else {
				armCatcher();
			}
		} else {
			ignorePointerId = undefined;
			catcherArmed = false;
			chrome.disableInteractive();
			glass.disableInteractive();
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
	}

	note.on('pointerdown', toggleMute);
	minusPlate.on('pointerdown', () => {
		bumpMaster(-volStep);
	});
	plusPlate.on('pointerdown', () => {
		bumpMaster(volStep);
	});
	minusGlyph.on('pointerdown', () => {
		bumpMaster(-volStep);
	});
	plusGlyph.on('pointerdown', () => {
		bumpMaster(volStep);
	});
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
