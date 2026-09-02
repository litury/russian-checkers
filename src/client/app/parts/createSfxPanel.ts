import type Phaser from 'phaser';
import { computeFieldLayout } from '@/client/config/fieldLayout';
import { layout } from '@/client/config/layout';
import {
	getSfxMaster,
	getSfxMuted,
	setSfxMaster,
	setSfxMuted,
} from '@/client/modules/sfx/createTableSfx';

export const evmPanel = {
	width: 200,
	height: 96,
	well: 44,
	knobArt: 19,
} as const;

export const autoStorageKey = 'checkers.autoMove';

const pad = 8;
const gap = 6;
const catcherDepth = 13;
const panelDepth = 14;
const wellY = 34;
const muteWellX = 8;
const resignWellX = 106;
const autoWellX = 154;
const grooveLeft = 56;
const grooveWidth = 44;
const grooveY = wellY + evmPanel.well / 2;
const trackMin = grooveLeft + evmPanel.knobArt / 2;
const trackSpan = grooveWidth - evmPanel.knobArt;

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

let autoMove = true;

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

function muteTexture(): string {
	return getSfxMuted() ? 'hudMuteOff' : 'hudMute';
}

function autoTexture(): string {
	return autoMove ? 'hudAuto' : 'hudAutoOff';
}

function wellCenterX(wellX: number): number {
	return wellX + evmPanel.well / 2;
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

	const chrome = scene.add.image(0, 0, 'hudEvmPanel').setOrigin(0, 0);
	chrome.setDepth(panelDepth);
	chrome.setVisible(false);

	const mute = scene.add.image(0, 0, muteTexture()).setOrigin(0.5);
	mute.setDepth(panelDepth + 1);
	mute.setVisible(false);

	const resign = scene.add.image(0, 0, 'hudResign').setOrigin(0.5);
	resign.setDepth(panelDepth + 1);
	resign.setVisible(false);

	const auto = scene.add.image(0, 0, autoTexture()).setOrigin(0.5);
	auto.setDepth(panelDepth + 1);
	auto.setVisible(false);

	const knob = scene.add.image(0, 0, 'hudSliderKnob').setOrigin(0.5);
	knob.setDepth(panelDepth + 2);
	knob.setVisible(false);

	const trackHit = scene.add.rectangle(
		0,
		0,
		grooveWidth,
		evmPanel.well,
		0x000000,
		0,
	);
	trackHit.setDepth(panelDepth + 1);
	trackHit.setVisible(false);

	let px = 0;
	let py = 0;
	let open = false;
	let dragging = false;
	let catcherArmed = false;
	let ignorePointerId: number | undefined;

	function knobX(): number {
		return px + trackMin + getSfxMaster() * trackSpan;
	}

	function insidePanel(x: number, y: number): boolean {
		return (
			x >= px &&
			x <= px + evmPanel.width &&
			y >= py &&
			y <= py + evmPanel.height
		);
	}

	function paint(): void {
		mute.setTexture(muteTexture());
		auto.setTexture(autoTexture());
		knob.setPosition(knobX(), py + grooveY);
	}

	function placeHits(): void {
		const cy = py + grooveY;
		chrome.setPosition(px, py);
		mute.setPosition(px + wellCenterX(muteWellX), cy);
		resign.setPosition(px + wellCenterX(resignWellX), cy);
		auto.setPosition(px + wellCenterX(autoWellX), cy);
		trackHit.setPosition(px + grooveLeft + grooveWidth / 2, cy);
		knob.setPosition(knobX(), cy);
	}

	function setFromPointer(pointer: Pointer): void {
		const t = ((pointer.worldX ?? 0) - (px + trackMin)) / trackSpan;
		setSfxMaster(t);
		paint();
	}

	function armCatcher(): void {
		catcherArmed = true;
	}

	function setOpen(next: boolean, pointer?: Pointer): void {
		open = next;
		dragging = false;
		chrome.setVisible(next);
		mute.setVisible(next);
		resign.setVisible(next);
		auto.setVisible(next);
		knob.setVisible(next);
		trackHit.setVisible(next);
		catcher.setVisible(next);
		if (next) {
			ignorePointerId =
				typeof pointer?.id === 'number' ? pointer.id : undefined;
			catcherArmed = false;
			chrome.setInteractive();
			mute.setInteractive({ useHandCursor: true });
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
			mute.disableInteractive();
			resign.disableInteractive();
			auto.disableInteractive();
			knob.disableInteractive();
			trackHit.disableInteractive();
			catcher.disableInteractive();
		}
		handlers.onOpenChange?.(next);
	}

	mute.on('pointerdown', () => {
		setSfxMuted(!getSfxMuted());
		paint();
	});
	resign.on('pointerdown', () => {
		handlers.onResign?.();
	});
	auto.on('pointerdown', () => {
		setAutoMove(!autoMove);
		paint();
		handlers.onAutoChange?.();
	});
	knob.on('pointerdown', () => {
		dragging = true;
	});
	trackHit.on('pointerdown', (pointer: Pointer) => {
		dragging = true;
		const kx = knobX();
		if (Math.abs((pointer.worldX ?? 0) - kx) > evmPanel.knobArt / 2) {
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
			let x = Math.round(menuX - evmPanel.width + layout.hudMenu / 2);
			let y = Math.round(menuY + layout.hudMenu / 2 + gap);
			x = Math.max(pad, Math.min(x, width - pad - evmPanel.width));
			if (field.portrait && y + evmPanel.height > field.originY) {
				y = Math.round(menuY - evmPanel.height / 2);
				x = Math.round(menuX - layout.hudMenu / 2 - gap - evmPanel.width);
				x = Math.max(pad, x);
			} else if (y + evmPanel.height > height - pad) {
				y = Math.round(menuY - layout.hudMenu / 2 - gap - evmPanel.height);
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
