import type Phaser from 'phaser';
import { afterEach, describe, expect, it } from 'vitest';
import {
	getSfxMaster,
	setSfxMaster,
	setSfxMuted,
	sfxMaster,
} from '@/client/modules/sfx/createTableSfx';
import {
	autoStorageKey,
	createSfxPanel,
	getAutoMove,
	setAutoMove,
	sfxMonitor,
} from './createSfxPanel';

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
	setTexture: (key: string) => StubGo;
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
		setTexture(next: string) {
			go.key = next;
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
		setAutoMove(true);
	});

	it('mounts CRT glass HUD without EVM wells or megaphone', () => {
		expect(typeof document).toBe('undefined');
		expect(sfxMonitor.width).toBe(256);
		expect(sfxMonitor.height).toBe(192);
		expect(autoStorageKey).toBe('checkers.autoMove');
		expect(getAutoMove()).toBe(true);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		const keys = scene.images.map((img) => img.key);
		expect(keys).toContain('resultMonitor');
		expect(keys).toContain('hudGlassMeadow');
		expect(keys).toContain('hudPlateVol');
		expect(keys).toContain('hudNote');
		expect(keys).toContain('hudMusic');
		expect(keys).toContain('hudSliderKnob');
		expect(keys).toContain('hudPlate');
		expect(keys).toContain('hudResign');
		expect(keys).toContain('hudAuto');
		expect(keys).not.toContain('hudEvmPanel');
		expect(keys).not.toContain('hudMute');
		expect(keys).not.toContain('hudMuteOff');
		expect(scene.graphics).toHaveLength(0);
		const chrome = scene.images.find((img) => img.key === 'resultMonitor');
		const knob = scene.images.find((img) => img.key === 'hudSliderKnob');
		expect(knob?.displaySizeCalls).toEqual([]);
		panel.toggle();
		expect(chrome?.visible).toBe(true);
		expect(chrome?.interactive).toBe(true);
		panel.hide();
		expect(chrome?.visible).toBe(false);
	});

	it('toggles the SFX note and keeps the slider value', () => {
		setSfxMaster(0.8);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		const note = scene.images.find((img) => img.key === 'hudNote');
		panel.toggle();
		expect(note?.visible).toBe(true);
		expect(note?.interactive).toBe(true);
		note?.emit('pointerdown');
		expect(getSfxMaster()).toBe(0.8);
		note?.emit('pointerdown');
		expect(getSfxMaster()).toBe(0.8);
		panel.hide();
		expect(note?.interactive).toBe(false);
	});

	it('keeps the CRT open on slider, note, music, resign, and auto', () => {
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		panel.layout(380, 22, 400, 300);
		const chrome = scene.images.find((img) => img.key === 'resultMonitor');
		const note = scene.images.find((img) => img.key === 'hudNote');
		const music = scene.images.find((img) => img.key === 'hudMusic');
		const resign = scene.images.find((img) => img.key === 'hudResign');
		const auto = scene.images.find((img) => img.key === 'hudAuto');
		const trackHit = scene.rects[1];
		panel.toggle({ worldX: 380, worldY: 22, id: 1 });
		expect(chrome?.visible).toBe(true);
		note?.emit('pointerdown');
		music?.emit('pointerdown');
		resign?.emit('pointerdown');
		auto?.emit('pointerdown');
		trackHit.emit('pointerdown', { worldX: 200, worldY: 40, id: 2 });
		expect(chrome?.visible).toBe(true);
		expect(getAutoMove()).toBe(false);
		setAutoMove(true);
	});

	it('closes from the catcher only outside the CRT after arming', () => {
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		panel.layout(380, 22, 400, 300);
		const [catcher] = scene.rects;
		const chrome = scene.images.find((img) => img.key === 'resultMonitor');
		if (!chrome) {
			throw new Error('missing chrome');
		}
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
