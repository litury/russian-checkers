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

const glassX = 16;
const glassY = 12;
const glassW = 224;
const glassH = 168;
const muteSize = 28;
const trackW = 108;
const trackH = 6;
const trackHitH = 28;
const knob = 12;
const gap = 8;
const pad = 8;
const catcherDepth = 13;
const panelDepth = 14;
const tin = 0x5a564c;
const highlight = 0xc4d0b8;
const well = 0x2a241c;
const fill = 0xd9cbb8;
const knobFace = 0xe8e0d0;
const slash = 0x1a1410;

const rowW = muteSize + gap + trackW;
const muteX = glassX + Math.round((glassW - rowW) / 2);
const muteY = glassY + Math.round((glassH - muteSize) / 2);
const trackX = muteX + muteSize + gap;
const trackY = muteY + Math.round((muteSize - trackH) / 2);

type Pointer = {
	worldX?: number;
	worldY?: number;
	id?: number;
};

type PanelHandlers = {
	onOpenChange?: (open: boolean) => void;
};

export function createSfxPanel(
	scene: Phaser.Scene,
	handlers: PanelHandlers = {},
): {
	layout: (menuX: number, menuY: number, width: number, height: number) => void;
	toggle: (pointer?: Pointer) => void;
	hide: () => void;
	isOpen: () => boolean;
} {
	const catcher = scene.add.rectangle(0, 0, 16, 16, 0x000000, 0);
	catcher.setDepth(catcherDepth);
	catcher.setVisible(false);

	const chrome = scene.add.image(0, 0, 'resultMonitor').setOrigin(0, 0);
	chrome.setDepth(panelDepth);
	chrome.setVisible(false);

	const g = scene.add.graphics();
	g.setDepth(panelDepth + 1);
	g.setVisible(false);

	const muteHit = scene.add.rectangle(0, 0, muteSize, muteSize, 0x000000, 0);
	muteHit.setDepth(panelDepth + 2);
	muteHit.setVisible(false);

	const trackHit = scene.add.rectangle(0, 0, trackW, trackHitH, 0x000000, 0);
	trackHit.setDepth(panelDepth + 2);
	trackHit.setVisible(false);

	let px = 0;
	let py = 0;
	let open = false;
	let dragging = false;
	let catcherArmed = false;
	let ignorePointerId: number | undefined;

	function paint(): void {
		const linear = getSfxMaster();
		const muted = getSfxMuted();
		g.clear();
		g.setPosition(px, py);

		g.fillStyle(tin, 1);
		g.fillRect(muteX, muteY, muteSize, muteSize);
		g.fillStyle(well, 1);
		g.fillRect(muteX + 1, muteY + 1, muteSize - 2, muteSize - 2);
		g.fillStyle(fill, 1);
		g.fillRect(muteX + 6, muteY + 10, 6, 8);
		g.fillRect(muteX + 12, muteY + 8, 2, 12);
		g.fillRect(muteX + 14, muteY + 9, 2, 10);
		g.fillRect(muteX + 16, muteY + 11, 2, 6);
		if (muted) {
			g.fillStyle(slash, 1);
			g.fillRect(muteX + 5, muteY + 6, 2, 2);
			g.fillRect(muteX + 7, muteY + 8, 2, 2);
			g.fillRect(muteX + 9, muteY + 10, 2, 2);
			g.fillRect(muteX + 11, muteY + 12, 2, 2);
			g.fillRect(muteX + 13, muteY + 14, 2, 2);
			g.fillRect(muteX + 15, muteY + 16, 2, 2);
			g.fillRect(muteX + 17, muteY + 18, 2, 2);
		}

		g.fillStyle(well, 1);
		g.fillRect(trackX, trackY, trackW, trackH);
		const filled = Math.round(trackW * linear);
		if (filled > 0) {
			g.fillStyle(muted ? tin : fill, 1);
			g.fillRect(trackX, trackY, filled, trackH);
		}
		const kx = Math.round(trackX + linear * (trackW - 1) - knob / 2);
		const ky = Math.round(trackY + trackH / 2 - knob / 2);
		g.fillStyle(tin, 1);
		g.fillRect(kx, ky, knob, knob);
		g.fillStyle(knobFace, 1);
		g.fillRect(kx + 1, ky + 1, knob - 2, knob - 2);
		g.fillStyle(highlight, 1);
		g.fillRect(kx + 2, ky + 2, 3, 1);
	}

	function placeHits(): void {
		chrome.setPosition(px, py);
		muteHit.setPosition(px + muteX + muteSize / 2, py + muteY + muteSize / 2);
		trackHit.setPosition(px + trackX + trackW / 2, py + trackY + trackH / 2);
	}

	function insidePanel(x: number, y: number): boolean {
		return (
			x >= px &&
			x <= px + sfxMonitor.width &&
			y >= py &&
			y <= py + sfxMonitor.height
		);
	}

	function setFromPointer(pointer: Pointer): void {
		const t = ((pointer.worldX ?? 0) - (px + trackX)) / trackW;
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
		g.setVisible(next);
		muteHit.setVisible(next);
		trackHit.setVisible(next);
		catcher.setVisible(next);
		if (next) {
			ignorePointerId =
				typeof pointer?.id === 'number' ? pointer.id : undefined;
			catcherArmed = false;
			chrome.setInteractive();
			muteHit.setInteractive({ useHandCursor: true });
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
			muteHit.disableInteractive();
			trackHit.disableInteractive();
			catcher.disableInteractive();
		}
		handlers.onOpenChange?.(next);
	}

	muteHit.on('pointerdown', () => {
		setSfxMuted(!getSfxMuted());
		paint();
	});
	trackHit.on('pointerdown', (pointer: Pointer) => {
		dragging = true;
		setFromPointer(pointer);
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
