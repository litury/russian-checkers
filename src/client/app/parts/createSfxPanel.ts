import type Phaser from 'phaser';
import { computeFieldLayout } from '@/client/config/fieldLayout';
import { layout } from '@/client/config/layout';
import {
	getSfxMaster,
	getSfxMuted,
	setSfxMaster,
	setSfxMuted,
} from '@/client/modules/sfx/createTableSfx';

const panelW = 168;
const panelH = 48;
const pad = 8;
const muteSize = 28;
const trackW = 108;
const trackH = 6;
const trackHitH = 28;
const knob = 12;
const gap = 6;
const catcherDepth = 13;
const panelDepth = 14;
const tin = 0x5a564c;
const meadow = 0x8da583;
const highlight = 0xc4d0b8;
const well = 0x2a241c;
const fill = 0xd9cbb8;
const knobFace = 0xe8e0d0;
const slash = 0x1a1410;

type PointerX = { worldX: number };

export function createSfxPanel(scene: Phaser.Scene): {
	layout: (menuX: number, menuY: number, width: number, height: number) => void;
	toggle: () => void;
	hide: () => void;
} {
	const catcher = scene.add.rectangle(0, 0, 16, 16, 0x000000, 0);
	catcher.setDepth(catcherDepth);
	catcher.setVisible(false);

	const g = scene.add.graphics();
	g.setDepth(panelDepth);
	g.setVisible(false);

	const muteHit = scene.add.rectangle(0, 0, muteSize, muteSize, 0x000000, 0);
	muteHit.setDepth(panelDepth + 1);
	muteHit.setVisible(false);

	const trackHit = scene.add.rectangle(0, 0, trackW, trackHitH, 0x000000, 0);
	trackHit.setDepth(panelDepth + 1);
	trackHit.setVisible(false);

	let px = 0;
	let py = 0;
	let trackX = 0;
	let trackY = 0;
	let open = false;
	let dragging = false;

	function muteX(): number {
		return pad;
	}

	function muteY(): number {
		return Math.round((panelH - muteSize) / 2);
	}

	function paint(): void {
		// hud_mute / hud_mute_off / hud_slider_knob will replace the drawn mute/knob when 2D drops them.
		const linear = getSfxMaster();
		const muted = getSfxMuted();
		g.clear();
		g.setPosition(px, py);
		g.fillStyle(tin, 1);
		g.fillRect(0, 0, panelW, panelH);
		g.fillStyle(meadow, 1);
		g.fillRect(1, 1, panelW - 2, panelH - 2);
		g.fillStyle(highlight, 1);
		g.fillRect(2, 2, panelW - 4, 1);
		g.fillStyle(well, 1);
		g.fillRect(2, panelH - 3, panelW - 4, 1);

		const mx = muteX();
		const my = muteY();
		g.fillStyle(tin, 1);
		g.fillRect(mx, my, muteSize, muteSize);
		g.fillStyle(well, 1);
		g.fillRect(mx + 1, my + 1, muteSize - 2, muteSize - 2);
		g.fillStyle(fill, 1);
		g.fillRect(mx + 6, my + 10, 6, 8);
		g.fillRect(mx + 12, my + 8, 2, 12);
		g.fillRect(mx + 14, my + 9, 2, 10);
		g.fillRect(mx + 16, my + 11, 2, 6);
		if (muted) {
			g.fillStyle(slash, 1);
			g.fillRect(mx + 5, my + 6, 2, 2);
			g.fillRect(mx + 7, my + 8, 2, 2);
			g.fillRect(mx + 9, my + 10, 2, 2);
			g.fillRect(mx + 11, my + 12, 2, 2);
			g.fillRect(mx + 13, my + 14, 2, 2);
			g.fillRect(mx + 15, my + 16, 2, 2);
			g.fillRect(mx + 17, my + 18, 2, 2);
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
		muteHit.setPosition(
			px + muteX() + muteSize / 2,
			py + muteY() + muteSize / 2,
		);
		trackHit.setPosition(px + trackX + trackW / 2, py + trackY + trackH / 2);
	}

	function setFromPointer(pointer: PointerX): void {
		const t = (pointer.worldX - (px + trackX)) / trackW;
		setSfxMaster(t);
		paint();
	}

	function setOpen(next: boolean): void {
		open = next;
		dragging = false;
		g.setVisible(next);
		muteHit.setVisible(next);
		trackHit.setVisible(next);
		catcher.setVisible(next);
		if (next) {
			muteHit.setInteractive({ useHandCursor: true });
			trackHit.setInteractive({ useHandCursor: true });
			catcher.setInteractive();
			paint();
		} else {
			muteHit.disableInteractive();
			trackHit.disableInteractive();
			catcher.disableInteractive();
		}
	}

	muteHit.on('pointerdown', () => {
		setSfxMuted(!getSfxMuted());
		paint();
	});
	trackHit.on('pointerdown', (pointer: PointerX) => {
		dragging = true;
		setFromPointer(pointer);
	});
	scene.input.on('pointermove', (pointer: PointerX) => {
		if (!dragging || !open) {
			return;
		}
		setFromPointer(pointer);
	});
	scene.input.on('pointerup', () => {
		dragging = false;
	});
	catcher.on('pointerdown', () => {
		setOpen(false);
	});

	return {
		layout: (menuX, menuY, width, height) => {
			const field = computeFieldLayout(width, height);
			trackX = pad + muteSize + gap;
			trackY = Math.round((panelH - trackH) / 2);
			let x = Math.round(menuX - panelW + layout.hudMenu / 2);
			let y = Math.round(menuY + layout.hudMenu / 2 + gap);
			x = Math.max(pad, Math.min(x, width - pad - panelW));
			if (field.portrait && y + panelH > field.originY) {
				y = Math.round(menuY - panelH / 2);
				x = Math.round(menuX - layout.hudMenu / 2 - gap - panelW);
				x = Math.max(pad, x);
			} else if (y + panelH > height - pad) {
				y = Math.round(menuY - layout.hudMenu / 2 - gap - panelH);
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
		toggle: () => {
			setOpen(!open);
		},
		hide: () => {
			setOpen(false);
		},
	};
}
