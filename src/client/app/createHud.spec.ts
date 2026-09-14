import type Phaser from 'phaser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clipPlayerName,
	createHud,
	hudClockEHotKey,
	hudClockEIdleKey,
	hudClockEOk1Key,
	hudClockEOk2Key,
	hudClockFaceKey,
	hudNamePlankKey,
} from './createHud';

type Handler = (...args: unknown[]) => void;

type StubGo = {
	visible: boolean;
	key?: string;
	text?: string;
	fontSize?: string;
	scaleY: number;
	x: number;
	y: number;
	displayW: number;
	displayH: number;
	rotation: number;
	setDepth: () => StubGo;
	setVisible: (value: boolean) => StubGo;
	setPosition: (x?: number, y?: number) => StubGo;
	setDisplaySize: (w?: number, h?: number) => StubGo;
	setSize: (w: number, h: number) => StubGo;
	setInteractive: () => StubGo;
	disableInteractive: () => StubGo;
	setOrigin: (x?: number, y?: number) => StubGo;
	setScale: (x: number, y?: number) => StubGo;
	setStroke: () => StubGo;
	setText: () => StubGo;
	setFontFamily: (family: string) => StubGo;
	setFontSize: (size?: number) => StubGo;
	setTexture: (key: string) => StubGo;
	setFlipX: () => StubGo;
	setRotation: (r: number) => StubGo;
	lineStyle: () => StubGo;
	lineBetween: () => StubGo;
	clear: () => StubGo;
	fillStyle: () => StubGo;
	fillRect: () => StubGo;
	on: (event: string, fn: Handler) => StubGo;
	emit: (event: string, ...args: unknown[]) => void;
};

function stubGo(key?: string): StubGo {
	const handlers: Record<string, Handler[]> = {};
	const go: StubGo = {
		visible: false,
		key,
		scaleY: 1,
		x: 0,
		y: 0,
		displayW: 0,
		displayH: 0,
		rotation: 0,
		setDepth() {
			return go;
		},
		setVisible(value: boolean) {
			go.visible = value;
			return go;
		},
		setPosition(x?: number, y?: number) {
			if (typeof x === 'number') {
				go.x = x;
			}
			if (typeof y === 'number') {
				go.y = y;
			}
			return go;
		},
		setDisplaySize(w?: number, h?: number) {
			if (typeof w === 'number') {
				go.displayW = w;
			}
			if (typeof h === 'number') {
				go.displayH = h;
			}
			return go;
		},
		setSize(w: number, h: number) {
			go.displayW = w;
			go.displayH = h;
			return go;
		},
		setInteractive() {
			return go;
		},
		disableInteractive() {
			return go;
		},
		setOrigin(_x?: number, _y?: number) {
			return go;
		},
		setScale(_x: number, y?: number) {
			go.scaleY = y ?? _x;
			go.displayW = 64;
			go.displayH = 64;
			return go;
		},
		setStroke() {
			return go;
		},
		setText(next?: string) {
			if (typeof next === 'string') {
				go.text = next;
			}
			return go;
		},
		setFontFamily() {
			return go;
		},
		setFontSize() {
			return go;
		},
		setTexture(next: string) {
			go.key = next;
			return go;
		},
		setFlipX() {
			return go;
		},
		setRotation(r: number) {
			go.rotation = r;
			return go;
		},
		lineStyle() {
			return go;
		},
		lineBetween() {
			return go;
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

type DelayCall = {
	ms: number;
	fn: () => void;
	removed: boolean;
};

function stubHudScene(): Phaser.Scene & {
	rects: StubGo[];
	images: StubGo[];
	texts: StubGo[];
	tileSprites: StubGo[];
	timeCalls: DelayCall[];
	emitInput: (event: string, ...args: unknown[]) => void;
} {
	const rects: StubGo[] = [];
	const images: StubGo[] = [];
	const texts: StubGo[] = [];
	const tileSprites: StubGo[] = [];
	const timeCalls: DelayCall[] = [];
	const inputHandlers: Record<string, Handler[]> = {};
	return {
		rects,
		images,
		texts,
		tileSprites,
		timeCalls,
		add: {
			text: (
				_x: number,
				_y: number,
				content: string,
				style?: { fontSize?: string },
			) => {
				const go = stubGo();
				go.text = content;
				go.fontSize = style?.fontSize;
				texts.push(go);
				return go;
			},
			image: (_x: number, _y: number, key: string) => {
				const go = stubGo(key);
				images.push(go);
				return go;
			},
			tileSprite: (
				_x: number,
				_y: number,
				w: number,
				h: number,
				key: string,
			) => {
				const go = stubGo(key);
				go.displayW = w;
				go.displayH = h;
				tileSprites.push(go);
				return go;
			},
			rectangle: () => {
				const go = stubGo();
				rects.push(go);
				return go;
			},
			graphics: () => stubGo(),
		},
		events: { once() {} },
		input: {
			on(event: string, fn: Handler) {
				let list = inputHandlers[event];
				if (!list) {
					list = [];
					inputHandlers[event] = list;
				}
				list.push(fn);
			},
		},
		time: {
			delayedCall(ms: number, fn: () => void) {
				const call: DelayCall = { ms, fn, removed: false };
				timeCalls.push(call);
				return {
					remove() {
						call.removed = true;
					},
				};
			},
		},
		tweens: {
			killTweensOf() {},
			add() {
				return {};
			},
		},
		emitInput(event: string, ...args: unknown[]) {
			for (const fn of inputHandlers[event] ?? []) {
				fn(...args);
			}
		},
	} as unknown as Phaser.Scene & {
		rects: StubGo[];
		images: StubGo[];
		texts: StubGo[];
		tileSprites: StubGo[];
		timeCalls: DelayCall[];
		emitInput: (event: string, ...args: unknown[]) => void;
	};
}

describe('createHud', () => {
	beforeEach(() => {
		const dialog = {
			open: false,
			close() {
				this.open = false;
			},
			addEventListener() {},
			removeEventListener() {},
		};
		vi.stubGlobal('document', {
			createElement: () => null,
			getElementById: () => dialog,
			activeElement: { tagName: 'BUTTON' },
		});
		vi.stubGlobal('window', {
			addEventListener() {},
			removeEventListener() {},
			checkersSettings: {
				open: () => {
					dialog.open = true;
				},
			},
		});
	});
	afterEach(() => vi.unstubAllGlobals());
	it('creates no in-match menu, settings, AI or resign entry', () => {
		const scene = stubHudScene();
		const createElement = vi.fn();
		vi.stubGlobal('document', { createElement });
		const hud = createHud(scene);
		hud.layout(390, 844);
		hud.setVisible(true);
		expect(scene.images.some(img => /hud(Menu|Ai|Resign)/.test(img.key ?? ''))).toBe(false);
		expect(scene.rects).toHaveLength(0);
		expect(createElement).not.toHaveBeenCalled();
		expect(hud.isMenuOpen()).toBe(false);
	});

	it('places portrait clocks inset with 112 shell', () => {
		const scene = stubHudScene();
		const hud = createHud(scene);
		hud.layout(390, 694);
		const face = scene.images.find((img) => img.key === hudClockFaceKey);
		const shells = scene.images.filter((img) => img.key === hudClockEIdleKey);
		expect(face?.visible).toBe(false);
		expect(shells[0]?.x).toBeGreaterThanOrEqual(16);
		expect(shells[0]?.displayW).toBe(112);
		expect(shells[0]?.displayH).toBe(70);
		hud.setClock(60, 45, 'white');
		expect(scene.texts.some((t) => t.fontSize === '20px')).toBe(true);
		expect(scene.texts.some((t) => t.text === 'Ты')).toBe(true);
		expect(scene.texts.some((t) => t.text === 'Бот')).toBe(true);
		expect(shells[0]?.key).toBe(hudClockEHotKey);
		expect(shells[1]?.key).toBe(hudClockEOk2Key);
		const planks = scene.images.filter((img) => img.key === hudNamePlankKey);
		expect(planks).toHaveLength(2);
		expect(planks[0]?.displayW).toBe(160);
		expect(planks[0]?.displayH).toBe(128);
		expect(planks[0]?.y).toBe(shells[0]?.y);
		const grass = scene.images.filter((img) =>
			String(img.key).startsWith('hudClockGrass'),
		);
		expect(grass).toHaveLength(0);
	});

	it('holds lamp frame 2 on your turn and plays 2-1-0 only on turn change', () => {
		const scene = stubHudScene();
		const hud = createHud(scene);
		hud.setClock(60, 45, 'white');
		const you = scene.images
			.filter((img) => img.key?.startsWith('hudClockE'))
			.at(-1);
		const foe = scene.images.find((img) => img.key === hudClockEHotKey);
		expect(you?.key).toBe(hudClockEOk2Key);
		expect(foe?.key).toBe(hudClockEHotKey);
		const before = scene.timeCalls.length;
		hud.setClock(59, 45, 'white');
		expect(scene.timeCalls.length).toBe(before);
		expect(you?.key).toBe(hudClockEOk2Key);
		hud.setClock(59, 45, 'black');
		expect(you?.key).toBe(hudClockEOk2Key);
		scene.timeCalls.at(-1)?.fn();
		expect(you?.key).toBe(hudClockEOk1Key);
		hud.setClock(59, 45, null);
		expect(you?.key).toBe(hudClockEHotKey);
		expect(foe?.key).toBe(hudClockEHotKey);
	});

	it('clips names to 12 glyphs', () => {
		expect(clipPlayerName('Ты')).toBe('Ты');
		expect(clipPlayerName('двенадцатьсим')).toHaveLength(12);
		expect(clipPlayerName('двенадцатьсимволов')).toMatch(/…$/);
	});

	it('hides clock digits until Tiny5 load then shows them', async () => {
		let resolveLoad: (() => void) | undefined;
		const previous = (globalThis as { document?: unknown }).document;
		(
			globalThis as {
				document: { fonts: { load: (q: string) => Promise<unknown> } };
			}
		).document = {
			...(previous as object),
			fonts: {
				load: () =>
					new Promise((resolve) => {
						resolveLoad = () => {
							resolve([]);
						};
					}),
			},
		};
		try {
			const scene = stubHudScene();
			createHud(scene);
			const clocks = scene.texts.filter(
				(t) => t.fontSize === '20px' && t.text !== 'Ты' && t.text !== 'Бот',
			);
			expect(clocks.length).toBe(2);
			expect(clocks.every((t) => t.visible === false)).toBe(true);
			resolveLoad?.();
			await Promise.resolve();
			expect(clocks.every((t) => t.visible === true)).toBe(true);
		} finally {
			if (previous === undefined) {
				Reflect.deleteProperty(globalThis, 'document');
			} else {
				(globalThis as { document?: unknown }).document = previous;
			}
		}
	});
});
