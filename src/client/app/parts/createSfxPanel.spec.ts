import type Phaser from 'phaser';
import { afterEach, describe, expect, it } from 'vitest';
import { palette } from '@/client/config/palette';
import {
	getSfxMaster,
	getSfxMuted,
	setSfxMaster,
	setSfxMuted,
	sfxMaster,
} from '@/client/modules/sfx/createTableSfx';
import {
	autoStorageKey,
	createSfxPanel,
	getAutoMove,
	resignConfirmCopy,
	resignCopy,
	setAutoMove,
	sfxMonitor,
} from './createSfxPanel';

type Handler = (...args: unknown[]) => void;

type Fill = { color: number; x: number; y: number; w: number; h: number };

type StubGo = {
	visible: boolean;
	interactive: boolean;
	key?: string;
	content?: string;
	x: number;
	y: number;
	scaleY: number;
	displaySizeCalls: Array<[number, number]>;
	fills: Fill[];
	fillColor: number;
	setDepth: () => StubGo;
	setVisible: (value: boolean) => StubGo;
	setPosition: (x: number, y: number) => StubGo;
	setDisplaySize: (w: number, h: number) => StubGo;
	setInteractive: () => StubGo;
	disableInteractive: () => StubGo;
	setOrigin: () => StubGo;
	setTexture: (key: string) => StubGo;
	setStroke: () => StubGo;
	setText: (next: string) => StubGo;
	setScale: (x: number, y?: number) => StubGo;
	on: (event: string, fn: Handler) => StubGo;
	emit: (event: string, ...args: unknown[]) => void;
	clear: () => StubGo;
	fillStyle: (color: number) => StubGo;
	fillRect: (x: number, y: number, w: number, h: number) => StubGo;
};

function stubGo(key?: string): StubGo {
	const handlers: Record<string, Handler[]> = {};
	const go: StubGo = {
		visible: false,
		interactive: false,
		key,
		content: undefined,
		x: 0,
		y: 0,
		scaleY: 1,
		displaySizeCalls: [],
		fills: [],
		fillColor: 0,
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
		setStroke() {
			return go;
		},
		setText(next: string) {
			go.content = next;
			return go;
		},
		setScale(_x: number, y?: number) {
			go.scaleY = y ?? _x;
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
			go.fills = [];
			return go;
		},
		fillStyle(color: number) {
			go.fillColor = color;
			return go;
		},
		fillRect(x: number, y: number, w: number, h: number) {
			go.fills.push({ color: go.fillColor, x, y, w, h });
			return go;
		},
	};
	return go;
}

function stubPanelScene(): Phaser.Scene & {
	rects: StubGo[];
	images: StubGo[];
	texts: StubGo[];
	graphics: StubGo[];
	timeCalls: Array<() => void>;
} {
	const rects: StubGo[] = [];
	const images: StubGo[] = [];
	const texts: StubGo[] = [];
	const graphics: StubGo[] = [];
	const timeCalls: Array<() => void> = [];
	return {
		rects,
		images,
		texts,
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
			text: (_x: number, _y: number, content?: string) => {
				const go = stubGo();
				go.content = content;
				texts.push(go);
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
		texts: StubGo[];
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

	it('mounts a raised CRT with meter and no music key or resign', () => {
		expect(typeof document).toBe('undefined');
		expect(sfxMonitor.width).toBe(188);
		expect(sfxMonitor.height).toBe(148);
		expect(autoStorageKey).toBe('checkers.autoMove');
		expect(getAutoMove()).toBe(true);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		const keys = scene.images.map((img) => img.key);
		expect(keys).toContain('resultMonitor');
		expect(keys).toContain('hudGlassMeadow');
		expect(keys).toContain('hudNote');
		expect(keys).toContain('hudPlate');
		expect(keys).not.toContain('hudMusic');
		expect(keys).not.toContain('hudMusicOff');
		expect(keys).not.toContain('hudPlateVol');
		expect(keys).not.toContain('hudSliderKnob');
		expect(keys).not.toContain('hudResign');
		expect(keys).not.toContain('hudAuto');
		expect(keys).not.toContain('hudAi');
		expect(keys).not.toContain('hudActionMoat');
		expect(keys).not.toContain('hudEvmPanel');
		expect(keys).not.toContain('hudMute');
		expect(keys).not.toContain('hudMuteOff');
		expect(scene.graphics).toHaveLength(1);
		const chrome = scene.images.find((img) => img.key === 'resultMonitor');
		panel.toggle();
		expect(chrome?.visible).toBe(true);
		expect(chrome?.interactive).toBe(false);
		expect(scene.graphics[0]?.visible).toBe(true);
		panel.hide();
		expect(chrome?.visible).toBe(false);
	});

	it('toggles the SFX note to zero master and restores on unmute', () => {
		setSfxMaster(0.8);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		const note = scene.images.find((img) => img.key === 'hudNote');
		const plates = scene.images.filter((img) => img.key === 'hudPlate');
		panel.layout(380, 22, 400, 300);
		panel.toggle();
		expect(note?.visible).toBe(true);
		expect(note?.interactive).toBe(false);
		expect(plates[2]?.interactive).toBe(true);
		plates[2]?.emit('pointerdown');
		expect(getSfxMaster()).toBe(0);
		expect(getSfxMuted()).toBe(true);
		const goldMuted = scene.graphics[0]?.fills.find(
			(fill) => fill.color === palette.meterGold,
		);
		expect(goldMuted?.w).toBe(0);
		plates[2]?.emit('pointerdown');
		expect(getSfxMaster()).toBe(0.8);
		expect(getSfxMuted()).toBe(false);
		const goldRestored = scene.graphics[0]?.fills.find(
			(fill) => fill.color === palette.meterGold,
		);
		expect(goldRestored?.w).toBeCloseTo(140 * 0.8);
		panel.hide();
		expect(plates[2]?.interactive).toBe(false);
	});

	it('keeps chrome and glass inert so the note plate gets pointerdown', () => {
		setSfxMaster(0.8);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		const chrome = scene.images.find((img) => img.key === 'resultMonitor');
		const glass = scene.images.find((img) => img.key === 'hudGlassMeadow');
		const note = scene.images.find((img) => img.key === 'hudNote');
		const plates = scene.images.filter((img) => img.key === 'hudPlate');
		panel.layout(380, 22, 400, 300);
		panel.toggle();
		expect(chrome?.interactive).toBe(false);
		expect(glass?.interactive).toBe(false);
		expect(note?.interactive).toBe(false);
		expect(plates[0]?.interactive).toBe(true);
		plates[2]?.emit('pointerdown');
		expect(getSfxMuted()).toBe(true);
		expect(getSfxMaster()).toBe(0);
		expect(note?.key).toBe('hudNoteOff');
		const goldMuted = scene.graphics[0]?.fills.find(
			(fill) => fill.color === palette.meterGold,
		);
		expect(goldMuted?.w).toBe(0);
		plates[2]?.emit('pointerdown');
		expect(getSfxMuted()).toBe(false);
		expect(getSfxMaster()).toBe(0.8);
	});

	it('steps volume on minus and plus and paints a tin/gold meter', () => {
		setSfxMaster(0.4);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		panel.layout(380, 22, 400, 300);
		const chrome = scene.images.find((img) => img.key === 'resultMonitor');
		const plates = scene.images.filter((img) => img.key === 'hudPlate');
		expect(plates).toHaveLength(4);
		panel.toggle({ worldX: 380, worldY: 22, id: 1 });
		expect(chrome?.visible).toBe(true);
		const gold = scene.graphics[0]?.fills.find(
			(fill) => fill.color === palette.meterGold,
		);
		expect(gold?.w).toBeCloseTo(140 * 0.4);
		plates[0]?.emit('pointerdown');
		expect(getSfxMaster()).toBeCloseTo(0.3);
		plates[1]?.emit('pointerdown');
		plates[1]?.emit('pointerdown');
		expect(getSfxMaster()).toBeCloseTo(0.5);
		const goldAfter = scene.graphics[0]?.fills.find(
			(fill) => fill.color === palette.meterGold,
		);
		expect(goldAfter?.w).toBeCloseTo(140 * 0.5);
		expect(chrome?.visible).toBe(true);
		expect(getAutoMove()).toBe(true);
	});

	it('has no hudMusic in the panel and three plates not four', () => {
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		const keys = scene.images.map((img) => img.key);
		expect(keys).not.toContain('hudMusic');
		expect(keys).not.toContain('hudMusicOff');
		const plates = scene.images.filter((img) => img.key === 'hudPlate');
		expect(plates).toHaveLength(4);
		setSfxMaster(0.4);
		panel.layout(380, 22, 400, 300);
		panel.toggle();
		plates[2]?.emit('pointerdown');
		expect(getSfxMaster()).toBe(0);
		plates[0]?.emit('pointerdown');
		plates[1]?.emit('pointerdown');
		expect(getSfxMaster()).toBe(0);
		expect(getSfxMuted()).toBe(true);
	});

	it('keeps mute and meter at zero when plus or minus are tapped', () => {
		setSfxMaster(0.4);
		setSfxMuted(true);
		expect(getSfxMaster()).toBe(0);
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		panel.layout(380, 22, 400, 300);
		const plates = scene.images.filter((img) => img.key === 'hudPlate');
		const note = scene.images.find(
			(img) => img.key === 'hudNote' || img.key === 'hudNoteOff',
		);
		panel.toggle({ worldX: 380, worldY: 22, id: 1 });
		const goldMuted = scene.graphics[0]?.fills.find(
			(fill) => fill.color === palette.meterGold,
		);
		expect(goldMuted?.w).toBe(0);
		expect(note?.key).toBe('hudNoteOff');
		plates[0]?.emit('pointerdown');
		plates[1]?.emit('pointerdown');
		expect(getSfxMaster()).toBe(0);
		expect(getSfxMuted()).toBe(true);
		const goldPlus = scene.graphics[0]?.fills.find(
			(fill) => fill.color === palette.meterGold,
		);
		expect(goldPlus?.w).toBe(0);
		plates[2]?.emit('pointerdown');
		expect(getSfxMuted()).toBe(false);
		expect(getSfxMaster()).toBe(0.4);
		expect(note?.key).toBe('hudNote');
	});

	it('dips CRT note on pointerdown and restores on pointerup', () => {
		const scene = stubPanelScene();
		const panel = createSfxPanel(scene);
		panel.layout(380, 22, 400, 300);
		const note = scene.images.find((img) => img.key === 'hudNote');
		const plates = scene.images.filter((img) => img.key === 'hudPlate');
		panel.toggle({ worldX: 380, worldY: 22, id: 1 });
		const restY = note?.y ?? 0;
		plates[2]?.emit('pointerdown');
		expect(note?.scaleY).toBe(1);
		expect(note?.y).toBeGreaterThan(restY);
		plates[2]?.emit('pointerup');
		expect(note?.scaleY).toBe(1);
		expect(note?.y).toBe(restY);
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

	it('resigns on one Сдаться tap and spans the view width', () => {
		const scene = stubPanelScene();
		let resigns = 0;
		const panel = createSfxPanel(scene, {
			onResign: () => {
				resigns += 1;
			},
		});
		panel.layout(380, 22, 400, 300);
		const chrome = scene.images.find((img) => img.key === 'resultMonitor');
		expect(chrome?.displaySizeCalls.at(-1)).toEqual([188, 148]);
		expect(scene.texts.map((t) => t.content)).toContain(resignCopy);
		const resign = scene.texts.find((t) => t.content === resignCopy);
		const plates = scene.images.filter((img) => img.key === 'hudPlate');
		panel.toggle();
		expect(chrome?.visible).toBe(true);
		expect(getSfxMuted()).toBe(false);
		plates[2]?.emit('pointerdown');
		expect(getSfxMuted()).toBe(true);
		expect(scene.images.find((img) => img.key === 'hudNoteOff')?.key).toBe(
			'hudNoteOff',
		);
		plates[2]?.emit('pointerup');
		plates[2]?.emit('pointerdown');
		expect(getSfxMuted()).toBe(false);
		plates[3]?.emit('pointerdown');
		expect(resigns).toBe(0);
		expect(resign?.content).toBe(resignConfirmCopy);
		expect(chrome?.visible).toBe(true);
		plates[3]?.emit('pointerdown');
		expect(resigns).toBe(1);
		expect(chrome?.visible).toBe(false);
		panel.toggle();
		expect(resign?.content).toBe(resignCopy);
		panel.hide();
	});
});
