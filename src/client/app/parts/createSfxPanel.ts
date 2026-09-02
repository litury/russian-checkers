import type Phaser from 'phaser';
import { computeFieldLayout } from '@/client/config/fieldLayout';
import { layout } from '@/client/config/layout';
import {
	getSfxMaster,
	getSfxMuted,
	setSfxMaster,
	setSfxMuted,
} from '@/client/modules/sfx/createTableSfx';

export const sfxMonitor = {
	width: 256,
	height: 192,
} as const;

export const autoStorageKey = 'checkers.autoMove';
export const musicStorageKey = 'checkers.musicMuted';

const glassX = 16;
const glassY = 12;
const volW = 108;
const plate = 52;
const inset = 8;
const gap = 8;
const clusterGap = 4;
const knobArt = 19;
const slotLeft = 58;
const slotWidth = 40;
const slotMidY = 26;
const noteMidX = 26;
const catcherDepth = 13;
const panelDepth = 14;
const pad = 8;

const volX = inset;
const volY = inset;
const musicX = inset + volW + clusterGap;
const musicY = inset;
const resignX = musicX + plate;
const resignY = inset;
const autoX = resignX;
const autoY = inset + plate + gap;
const trackMin = slotLeft + knobArt / 2;
const trackSpan = slotWidth - knobArt;

let autoMove = true;
let musicMuted = false;

type Pointer = {
	worldX?: number;
	worldY?: number;
	id?: number;
};

type PanelHandlers = {
	onResign?: () => void;
	onAutoChange?: () => void;
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

function loadMusicMuted(): void {
	const store = readStorage();
	if (!store) {
		musicMuted = false;
		return;
	}
	const raw = store.getItem(musicStorageKey);
	musicMuted = raw === '1' || raw === 'true';
}

function writeMusicMuted(): void {
	const store = readStorage();
	if (!store) {
		return;
	}
	try {
		store.setItem(musicStorageKey, musicMuted ? '1' : '0');
	} catch {
		return;
	}
}

loadAutoMove();
loadMusicMuted();

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

function musicTexture(): string {
	return musicMuted ? 'hudMusicOff' : 'hudMusic';
}

function autoTexture(): string {
	return autoMove ? 'hudAuto' : 'hudAutoOff';
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
	loadMusicMuted();

	const catcher = scene.add.rectangle(0, 0, 16, 16, 0x000000, 0);
	catcher.setDepth(catcherDepth);
	catcher.setVisible(false);

	const glass = scene.add.image(0, 0, 'hudGlassMeadow').setOrigin(0, 0);
	glass.setDepth(panelDepth);
	glass.setVisible(false);

	const chrome = scene.add.image(0, 0, 'resultMonitor').setOrigin(0, 0);
	chrome.setDepth(panelDepth + 1);
	chrome.setVisible(false);

	const volPlate = scene.add.image(0, 0, 'hudPlateVol').setOrigin(0, 0);
	volPlate.setDepth(panelDepth + 2);
	volPlate.setVisible(false);

	const musicPlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0, 0);
	musicPlate.setDepth(panelDepth + 2);
	musicPlate.setVisible(false);

	const resignPlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0, 0);
	resignPlate.setDepth(panelDepth + 2);
	resignPlate.setVisible(false);

	const autoPlate = scene.add.image(0, 0, 'hudPlate').setOrigin(0, 0);
	autoPlate.setDepth(panelDepth + 2);
	autoPlate.setVisible(false);

	const note = scene.add.image(0, 0, noteTexture()).setOrigin(0.5);
	note.setDepth(panelDepth + 3);
	note.setVisible(false);

	const music = scene.add.image(0, 0, musicTexture()).setOrigin(0.5);
	music.setDepth(panelDepth + 3);
	music.setVisible(false);

	const resign = scene.add.image(0, 0, 'hudResign').setOrigin(0.5);
	resign.setDepth(panelDepth + 3);
	resign.setVisible(false);

	const auto = scene.add.image(0, 0, autoTexture()).setOrigin(0.5);
	auto.setDepth(panelDepth + 3);
	auto.setVisible(false);

	const knob = scene.add.image(0, 0, 'hudSliderKnob').setOrigin(0.5);
	knob.setDepth(panelDepth + 4);
	knob.setVisible(false);

	const trackHit = scene.add.rectangle(0, 0, slotWidth, plate, 0x000000, 0);
	trackHit.setDepth(panelDepth + 3);
	trackHit.setVisible(false);

	let px = 0;
	let py = 0;
	let open = false;
	let dragging = false;
	let catcherArmed = false;
	let ignorePointerId: number | undefined;

	function knobX(): number {
		return px + glassX + volX + trackMin + getSfxMaster() * trackSpan;
	}

	function knobY(): number {
		return py + glassY + volY + slotMidY;
	}

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
		music.setTexture(musicTexture());
		auto.setTexture(autoTexture());
		knob.setPosition(knobX(), knobY());
	}

	function placeHits(): void {
		chrome.setPosition(px, py);
		glass.setPosition(px + glassX, py + glassY);
		volPlate.setPosition(px + glassX + volX, py + glassY + volY);
		musicPlate.setPosition(px + glassX + musicX, py + glassY + musicY);
		resignPlate.setPosition(px + glassX + resignX, py + glassY + resignY);
		autoPlate.setPosition(px + glassX + autoX, py + glassY + autoY);
		note.setPosition(
			px + glassX + volX + noteMidX,
			py + glassY + volY + slotMidY,
		);
		music.setPosition(
			px + glassX + musicX + plate / 2,
			py + glassY + musicY + plate / 2,
		);
		resign.setPosition(
			px + glassX + resignX + plate / 2,
			py + glassY + resignY + plate / 2,
		);
		auto.setPosition(
			px + glassX + autoX + plate / 2,
			py + glassY + autoY + plate / 2,
		);
		trackHit.setPosition(
			px + glassX + volX + slotLeft + slotWidth / 2,
			py + glassY + volY + slotMidY,
		);
		knob.setPosition(knobX(), knobY());
	}

	function setFromPointer(pointer: Pointer): void {
		const t =
			((pointer.worldX ?? 0) - (px + glassX + volX + trackMin)) / trackSpan;
		setSfxMaster(t);
		paint();
	}

	function armCatcher(): void {
		catcherArmed = true;
	}

	const plates = [volPlate, musicPlate, resignPlate, autoPlate];
	const icons = [note, music, resign, auto, knob];

	function setOpen(next: boolean, pointer?: Pointer): void {
		open = next;
		dragging = false;
		glass.setVisible(next);
		chrome.setVisible(next);
		for (const img of plates) {
			img.setVisible(next);
		}
		for (const img of icons) {
			img.setVisible(next);
		}
		trackHit.setVisible(next);
		catcher.setVisible(next);
		if (next) {
			ignorePointerId =
				typeof pointer?.id === 'number' ? pointer.id : undefined;
			catcherArmed = false;
			chrome.setInteractive();
			glass.setInteractive();
			note.setInteractive({ useHandCursor: true });
			music.setInteractive({ useHandCursor: true });
			resign.setInteractive({ useHandCursor: true });
			auto.setInteractive({ useHandCursor: true });
			knob.setInteractive({ useHandCursor: true });
			trackHit.setInteractive({ useHandCursor: true });
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
			music.disableInteractive();
			resign.disableInteractive();
			auto.disableInteractive();
			knob.disableInteractive();
			trackHit.disableInteractive();
			catcher.disableInteractive();
		}
		handlers.onOpenChange?.(next);
	}

	function toggleMute(): void {
		setSfxMuted(!getSfxMuted());
		paint();
	}

	function toggleMusic(): void {
		musicMuted = !musicMuted;
		writeMusicMuted();
		paint();
	}

	function toggleAuto(): void {
		setAutoMove(!autoMove);
		paint();
		handlers.onAutoChange?.();
	}

	function fireResign(): void {
		handlers.onResign?.();
	}

	note.on('pointerdown', toggleMute);
	music.on('pointerdown', toggleMusic);
	resign.on('pointerdown', fireResign);
	auto.on('pointerdown', toggleAuto);
	knob.on('pointerdown', () => {
		dragging = true;
	});
	trackHit.on('pointerdown', (pointer: Pointer) => {
		dragging = true;
		const kx = knobX();
		if (Math.abs((pointer.worldX ?? 0) - kx) > knobArt / 2) {
			setFromPointer(pointer);
		}
	});
	scene.input.on('pointermove', (pointer: Pointer) => {
		if (!dragging || !open) {
			return;
		}
		setFromPointer(pointer);
	});
	scene.input.on('pointerup', () => {
		dragging = false;
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
			let y = Math.round(menuY + layout.hudMenu / 2 + gap);
			x = Math.max(pad, Math.min(x, width - pad - sfxMonitor.width));
			if (field.portrait && y + sfxMonitor.height > field.originY) {
				y = Math.round(menuY - sfxMonitor.height / 2);
				x = Math.round(menuX - layout.hudMenu / 2 - gap - sfxMonitor.width);
				x = Math.max(pad, x);
			} else if (y + sfxMonitor.height > height - pad) {
				y = Math.round(menuY - layout.hudMenu / 2 - gap - sfxMonitor.height);
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
