import type Phaser from 'phaser';
import { afterEach, describe, expect, it } from 'vitest';
import {
	getSfxMaster,
	getSfxMuted,
	setSfxMaster,
	setSfxMuted,
	sfxMaster,
} from '@/client/modules/sfx/createTableSfx';
import {
	createSfxPanel,
	evmPanel,
	getAutoMove,
	setAutoMove,
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
	};
	return go;
}

function stubPanelScene(): Phaser.Scene & {
	rects: StubGo[];
	images: StubGo[];
	timeCalls: Array<() => void>;
} {
	const rects: StubGo[] = [];
	const images: StubGo[] = [];
	const timeCalls: Array<() => void> = [];
	return {
		rects,
		images,
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
		timeCalls: Array<() => void>;
	};
}

describe('createSfxPanel', () => {
	afterEach(() => {
		setSfxMaster(sfxMaster);
		setSfxMuted(false);
		setAutoMove(true);
	});

	it('mounts hud_evm_panel chrome instead of HTML or result_monitor', () => {
		expect(typeof document).toBe('undefined');
		expect(evmPanel.width).toBe(200);
		expect(evmPanel.height).toBe(96);
		expect(evmPanel.well).toBe(44);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		expect(scene.images.map((img) => img.key)).toEqual([
			'hudEvmPanel',
			'hudMute',
			'hudResign',
			'hudAuto',
			'hudSliderKnob',
		]);
		expect(scene.images.some((img) => img.key === 'resultMonitor')).toBe(false);
		expect(scene.images.some((img) => img.key === 'hudSliderTrack')).toBe(
			false,
		);
		const knob = scene.images.find((img) => img.key === 'hudSliderKnob');
		expect(knob?.displaySizeCalls).toEqual([]);
		panel.toggle();
		expect(scene.images[0].visible).toBe(true);
		expect(scene.images[0].interactive).toBe(true);
		panel.hide();
		expect(scene.images[0].visible).toBe(false);
	});

	it('toggles hud_mute sprites and keeps the slider value', () => {
		setSfxMaster(0.8);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		const mute = scene.images[1];
		panel.toggle();
		expect(mute.visible).toBe(true);
		expect(mute.interactive).toBe(true);
		expect(mute.key).toBe('hudMute');
		mute.emit('pointerdown');
		expect(getSfxMuted()).toBe(true);
		expect(getSfxMaster()).toBe(0.8);
		expect(mute.key).toBe('hudMuteOff');
		mute.emit('pointerdown');
		expect(getSfxMuted()).toBe(false);
		expect(getSfxMaster()).toBe(0.8);
		panel.hide();
		expect(mute.interactive).toBe(false);
	});

	it('toggles auto-move sprites with a true default', () => {
		expect(getAutoMove()).toBe(true);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		const auto = scene.images[3];
		panel.toggle();
		expect(auto.key).toBe('hudAuto');
		auto.emit('pointerdown');
		expect(getAutoMove()).toBe(false);
		expect(auto.key).toBe('hudAutoOff');
		auto.emit('pointerdown');
		expect(getAutoMove()).toBe(true);
	});

	it('fires resign from the middle well', () => {
		const scene = stubPanelScene();
		let resigned = 0;
		const panel = createSfxPanel(scene, {
			onResign: () => {
				resigned += 1;
			},
		});
		panel.toggle();
		scene.images[2].emit('pointerdown');
		expect(resigned).toBe(1);
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
