import type Phaser from 'phaser';
import { afterEach, describe, expect, it } from 'vitest';
import {
	getSfxMaster,
	setSfxMaster,
	setSfxMuted,
	sfxMaster,
} from '@/client/modules/sfx/createTableSfx';
import { createSfxPanel, sfxMonitor } from './createSfxPanel';

type Handler = (...args: unknown[]) => void;

type StubGo = {
	visible: boolean;
	interactive: boolean;
	key?: string;
	x: number;
	y: number;
	displaySizeCalls: Array<[number, number]>;
	setDepth: () => StubGo;
	setVisible: (value: boolean) => StubGo;
	setPosition: (x: number, y: number) => StubGo;
	setDisplaySize: (w: number, h: number) => StubGo;
	setInteractive: () => StubGo;
	disableInteractive: () => StubGo;
	setOrigin: () => StubGo;
	on: (event: string, fn: Handler) => StubGo;
	emit: (event: string, ...args: unknown[]) => void;
	clear: () => StubGo;
	fillStyle: () => StubGo;
	fillRect: () => StubGo;
};

function stubGo(key?: string): StubGo {
	const handlers: Record<string, Handler[]> = {};
	const go: StubGo = {
		visible: false,
		interactive: false,
		key,
		x: 0,
		y: 0,
		displaySizeCalls: [],
		setDepth() {
			return go;
		},
		setVisible(value: boolean) {
			go.visible = value;
			return go;
		},
		setPosition(x: number, y: number) {
			go.x = x;
			go.y = y;
			return go;
		},
		setDisplaySize(w: number, h: number) {
			go.displaySizeCalls.push([w, h]);
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
		setOrigin() {
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
	rects: StubGo[];
	images: StubGo[];
	graphics: StubGo[];
	timeCalls: Array<() => void>;
} {
	const rects: StubGo[] = [];
	const images: StubGo[] = [];
	const graphics: StubGo[] = [];
	const timeCalls: Array<() => void> = [];
	return {
		rects,
		images,
		graphics,
		timeCalls,
		add: {
			rectangle: () => {
				const go = stubGo();
				rects.push(go);
				return go;
			},
			image: (_x: number, _y: number, key: string) => {
				const go = stubGo(key);
				images.push(go);
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
		time: {
			delayedCall: (_ms: number, fn: () => void) => {
				timeCalls.push(fn);
				return {};
			},
		},
	} as unknown as Phaser.Scene & {
		rects: StubGo[];
		images: StubGo[];
		graphics: StubGo[];
		timeCalls: Array<() => void>;
	};
}

describe('createSfxPanel', () => {
	afterEach(() => {
		setSfxMaster(sfxMaster);
		setSfxMuted(false);
	});

	it('mounts result_monitor chrome instead of HTML or hud_evm_panel', () => {
		expect(typeof document).toBe('undefined');
		expect(sfxMonitor.width).toBe(256);
		expect(sfxMonitor.height).toBe(192);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		expect(scene.images.map((img) => img.key)).toEqual(['resultMonitor']);
		expect(scene.images.some((img) => img.key === 'hudEvmPanel')).toBe(false);
		expect(scene.images.some((img) => img.key === 'hudResign')).toBe(false);
		expect(scene.images.some((img) => img.key === 'hudAuto')).toBe(false);
		expect(scene.graphics).toHaveLength(1);
		expect(scene.rects).toHaveLength(3);
		panel.toggle();
		expect(scene.images[0].visible).toBe(true);
		expect(scene.images[0].interactive).toBe(true);
		expect(scene.graphics[0].visible).toBe(true);
		panel.hide();
		expect(scene.images[0].visible).toBe(false);
	});

	it('toggles drawn mute and keeps the slider value', () => {
		setSfxMaster(0.8);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		const muteHit = scene.rects[1];
		panel.toggle();
		expect(muteHit.visible).toBe(true);
		expect(muteHit.interactive).toBe(true);
		muteHit.emit('pointerdown');
		expect(getSfxMaster()).toBe(0.8);
		muteHit.emit('pointerdown');
		expect(getSfxMaster()).toBe(0.8);
		panel.hide();
		expect(muteHit.interactive).toBe(false);
	});

	it('closes from the catcher only outside the panel after arming', () => {
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		panel.layout(380, 22, 400, 300);
		const [catcher] = scene.rects;
		const chrome = scene.images[0];
		panel.toggle({ worldX: 380, worldY: 22, id: 7 });
		expect(chrome.visible).toBe(true);
		catcher.emit('pointerdown', { worldX: 10, worldY: 10, id: 7 });
		expect(chrome.visible).toBe(true);
		catcher.emit('pointerdown', { worldX: 10, worldY: 10, id: 8 });
		expect(chrome.visible).toBe(true);
		for (const fn of scene.timeCalls) {
			fn();
		}
		catcher.emit('pointerdown', {
			worldX: chrome.x + 20,
			worldY: chrome.y + 20,
			id: 9,
		});
		expect(chrome.visible).toBe(true);
		catcher.emit('pointerdown', { worldX: 10, worldY: 10, id: 9 });
		expect(chrome.visible).toBe(false);
	});
});
