import type Phaser from 'phaser';
import { afterEach, describe, expect, it } from 'vitest';
import {
	getSfxMaster,
	setSfxMaster,
	setSfxMuted,
	sfxMaster,
} from '@/client/modules/sfx/createTableSfx';
import { createSfxPanel } from './createSfxPanel';

type Handler = (...args: unknown[]) => void;

type StubGo = {
	visible: boolean;
	interactive: boolean;
	setDepth: () => StubGo;
	setVisible: (value: boolean) => StubGo;
	setPosition: (x: number, y: number) => StubGo;
	setDisplaySize: () => StubGo;
	setInteractive: () => StubGo;
	disableInteractive: () => StubGo;
	on: (event: string, fn: Handler) => StubGo;
	emit: (event: string, ...args: unknown[]) => void;
	clear: () => StubGo;
	fillStyle: () => StubGo;
	fillRect: () => StubGo;
};

function stubGo(): StubGo {
	const handlers: Record<string, Handler[]> = {};
	const go: StubGo = {
		visible: false,
		interactive: false,
		setDepth() {
			return go;
		},
		setVisible(value: boolean) {
			go.visible = value;
			return go;
		},
		setPosition() {
			return go;
		},
		setDisplaySize() {
			return go;
		},
		setInteractive() {
			go.interactive = true;
			return go;
		},
		disableInteractive() {
			go.interactive = false;
			return go;
		},
		on(event: string, fn: Handler) {
			let list = handlers[event];
			if (!list) {
				list = [];
				handlers[event] = list;
			}
			list.push(fn);
			return go;
		},
		emit(event: string, ...args: unknown[]) {
			const list = handlers[event] ?? [];
			for (const fn of list) {
				fn(...args);
			}
		},
		clear() {
			return go;
		},
		fillStyle() {
			return go;
		},
		fillRect() {
			return go;
		},
	};
	return go;
}

function stubPanelScene(): Phaser.Scene & {
	graphics: StubGo[];
	rects: StubGo[];
} {
	const rects: StubGo[] = [];
	const graphics: StubGo[] = [];
	return {
		rects,
		graphics,
		add: {
			rectangle: () => {
				const go = stubGo();
				rects.push(go);
				return go;
			},
			graphics: () => {
				const go = stubGo();
				graphics.push(go);
				return go;
			},
		},
		input: {
			on() {},
		},
	} as unknown as Phaser.Scene & { graphics: StubGo[]; rects: StubGo[] };
}

describe('createSfxPanel', () => {
	afterEach(() => {
		setSfxMaster(sfxMaster);
		setSfxMuted(false);
	});

	it('draws a Phaser graphics panel instead of an HTML range', () => {
		expect(typeof document).toBe('undefined');
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		expect(scene.graphics).toHaveLength(1);
		expect(scene.rects).toHaveLength(3);
		panel.toggle();
		expect(scene.graphics[0].visible).toBe(true);
		panel.hide();
		expect(scene.graphics[0].visible).toBe(false);
	});

	it('toggles drawn mute and track hits without loading hud_mute textures', () => {
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		const [catcher, muteHit, trackHit] = scene.rects;
		const [g] = scene.graphics;
		expect(g.visible).toBe(false);
		expect(catcher.visible).toBe(false);
		panel.toggle();
		expect(g.visible).toBe(true);
		expect(muteHit.visible).toBe(true);
		expect(trackHit.visible).toBe(true);
		expect(muteHit.interactive).toBe(true);
		panel.hide();
		expect(g.visible).toBe(false);
		expect(muteHit.interactive).toBe(false);
	});

	it('keeps the prior slider value when mute is toggled', () => {
		setSfxMaster(0.8);
		const scene = stubPanelScene();
		createSfxPanel(scene);
		const muteHit = scene.rects[1];
		muteHit.emit('pointerdown');
		expect(getSfxMaster()).toBe(0.8);
		muteHit.emit('pointerdown');
		expect(getSfxMaster()).toBe(0.8);
	});
});
