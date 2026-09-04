import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { layout } from '@/client/config/layout';
import { createHud } from './createHud';

type Handler = (...args: unknown[]) => void;

type StubGo = {
	visible: boolean;
	key?: string;
	scaleY: number;
	x: number;
	y: number;
	displayW: number;
	displayH: number;
	setDepth: () => StubGo;
	setVisible: (value: boolean) => StubGo;
	setPosition: (x?: number, y?: number) => StubGo;
	setDisplaySize: (w?: number, h?: number) => StubGo;
	setSize: (w: number, h: number) => StubGo;
	setInteractive: () => StubGo;
	disableInteractive: () => StubGo;
	setOrigin: () => StubGo;
	setScale: (x: number, y?: number) => StubGo;
	setStroke: () => StubGo;
	setText: () => StubGo;
	setTexture: (key: string) => StubGo;
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
		setOrigin() {
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
		setText() {
			return go;
		},
		setTexture(next: string) {
			go.key = next;
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
	tileSprites: StubGo[];
	timeCalls: DelayCall[];
	emitInput: (event: string, ...args: unknown[]) => void;
} {
	const rects: StubGo[] = [];
	const images: StubGo[] = [];
	const tileSprites: StubGo[] = [];
	const timeCalls: DelayCall[] = [];
	const inputHandlers: Record<string, Handler[]> = {};
	return {
		rects,
		images,
		tileSprites,
		timeCalls,
		add: {
			text: () => stubGo(),
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
		tileSprites: StubGo[];
		timeCalls: DelayCall[];
		emitInput: (event: string, ...args: unknown[]) => void;
	};
}

function flushMs(scene: { timeCalls: DelayCall[] }, ms: number): void {
	for (const call of scene.timeCalls) {
		if (!call.removed && call.ms === ms) {
			call.removed = true;
			call.fn();
		}
	}
}

describe('createHud', () => {
	it('swaps hamburger to press then open frames without scaleY', () => {
		const scene = stubHudScene();
		createHud(scene);
		const menuHit = scene.rects[0];
		const menuIcon = scene.images[0];
		const chrome = scene.images.find((img) => img.key === 'resultMonitor');
		expect(menuIcon.key).toBe('hudMenu');
		expect(scene.images.some((img) => img.key === 'hudResign')).toBe(false);
		expect(scene.images.some((img) => img.key === 'hudAi')).toBe(true);
		expect(scene.tileSprites.some((img) => img.key === 'hudActionMoat')).toBe(
			false,
		);
		expect(scene.images.some((img) => img.key === 'hudActionMoat')).toBe(false);
		expect(scene.images.some((img) => img.key === 'hudAuto')).toBe(false);
		expect(scene.images.some((img) => img.key === 'hudMusic')).toBe(false);
		expect(chrome?.visible).toBe(false);
		expect(scene.images.some((img) => img.key === 'hudEvmPanel')).toBe(false);
		expect(menuIcon.scaleY).toBe(1);
		menuHit.emit('pointerdown', { id: 1 });
		expect(chrome?.visible).toBe(true);
		expect(menuIcon.key).toBe('hudMenuPress');
		expect(menuIcon.scaleY).toBe(1);
		expect(menuIcon.y).toBe(0);
		menuHit.emit('pointerup', { id: 1 });
		expect(menuIcon.key).toBe('hudMenuPress');
		expect(menuIcon.scaleY).toBe(1);
		flushMs(scene, layout.pressMs);
		expect(menuIcon.key).toBe('hudMenuFold');
		expect(menuIcon.scaleY).toBe(1);
		flushMs(scene, layout.menuFoldMs);
		expect(menuIcon.key).toBe('hudMenuOpen');
		expect(menuIcon.scaleY).toBe(1);
		menuHit.emit('pointerdown', { id: 2 });
		expect(chrome?.visible).toBe(false);
		expect(menuIcon.key).toBe('hudMenuPress');
		menuHit.emit('pointerup', { id: 2 });
		expect(menuIcon.key).toBe('hudMenuPress');
		flushMs(scene, layout.pressMs);
		expect(menuIcon.key).toBe('hudMenuFold');
		flushMs(scene, layout.menuFoldMs);
		expect(menuIcon.key).toBe('hudMenu');
		expect(menuIcon.scaleY).toBe(1);
		expect(menuIcon.y).toBe(0);
	});

	it('jumps hamburger to X or idle when reduced-motion is set', () => {
		const previous = globalThis.matchMedia;
		(
			globalThis as { matchMedia?: (query: string) => { matches: boolean } }
		).matchMedia = () => ({ matches: true });
		try {
			const scene = stubHudScene();
			createHud(scene);
			const menuHit = scene.rects[0];
			const menuIcon = scene.images[0];
			menuHit.emit('pointerdown', { id: 1 });
			expect(menuIcon.key).toBe('hudMenuOpen');
			expect(menuIcon.scaleY).toBe(1);
			menuHit.emit('pointerdown', { id: 2 });
			expect(menuIcon.key).toBe('hudMenu');
		} finally {
			if (previous) {
				globalThis.matchMedia = previous;
			} else {
				Reflect.deleteProperty(globalThis, 'matchMedia');
			}
		}
	});

	it('hides the hamburger on title', () => {
		const scene = stubHudScene();
		const hud = createHud(scene);
		const menuIcon = scene.images[0];
		hud.setVisible(false);
		expect(menuIcon.visible).toBe(false);
		hud.setVisible(true);
		expect(menuIcon.visible).toBe(true);
	});

	it('places 44px AI under the menu on the right without a resign stone', () => {
		const scene = stubHudScene();
		const hud = createHud(scene);
		hud.layout(390, 694);
		const moat = scene.tileSprites.find((img) => img.key === 'hudActionMoat');
		const resign = scene.images.find((img) => img.key === 'hudResign');
		const ai = scene.images.find((img) => img.key === 'hudAi');
		const menuX = 390 - layout.hudMenu / 2;
		const menuY = layout.hudBar / 2;
		expect(moat).toBeUndefined();
		expect(resign).toBeUndefined();
		expect(layout.hudAiW).toBe(44);
		expect(ai?.x).toBe(menuX);
		expect(ai?.y).toBe(
			menuY + layout.hudMenu / 2 + layout.hudActionGap + layout.hudAiH / 2,
		);
		expect(ai?.scaleY).toBe(1);
	});

	it('keeps AI display at 44 after click juice', () => {
		const scene = stubHudScene();
		createHud(scene);
		const ai = scene.images.find((img) => img.key === 'hudAi');
		expect(ai?.displayW).toBe(44);
		ai?.emit('pointerdown');
		ai?.emit('pointerup');
		expect(ai?.displayW).toBe(44);
		expect(ai?.displayH).toBe(44);
	});
});
