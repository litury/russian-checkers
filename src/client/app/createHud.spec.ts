import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { layout } from '@/client/config/layout';
import { createHud, resignArmMs } from './createHud';

type Handler = (...args: unknown[]) => void;

type StubGo = {
	visible: boolean;
	key?: string;
	scaleY: number;
	x: number;
	y: number;
	setDepth: () => StubGo;
	setVisible: (value: boolean) => StubGo;
	setPosition: (x?: number, y?: number) => StubGo;
	setDisplaySize: () => StubGo;
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
		setDisplaySize() {
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
	timeCalls: DelayCall[];
	emitInput: (event: string, ...args: unknown[]) => void;
} {
	const rects: StubGo[] = [];
	const images: StubGo[] = [];
	const timeCalls: DelayCall[] = [];
	const inputHandlers: Record<string, Handler[]> = {};
	return {
		rects,
		images,
		timeCalls,
		add: {
			text: () => stubGo(),
			image: (_x: number, _y: number, key: string) => {
				const go = stubGo(key);
				images.push(go);
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
		expect(scene.images.some((img) => img.key === 'hudResign')).toBe(true);
		expect(scene.images.some((img) => img.key === 'hudAuto')).toBe(true);
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
		expect(menuIcon.key).toBe('hudMenuOpen');
		expect(menuIcon.scaleY).toBe(1);
		menuHit.emit('pointerdown', { id: 2 });
		expect(chrome?.visible).toBe(false);
		expect(menuIcon.key).toBe('hudMenuPress');
		menuHit.emit('pointerup', { id: 2 });
		expect(menuIcon.key).toBe('hudMenuPress');
		flushMs(scene, layout.pressMs);
		expect(menuIcon.key).toBe('hudMenu');
		expect(menuIcon.scaleY).toBe(1);
		expect(menuIcon.y).toBe(0);
	});

	it('lifts the action strip by inset plus moat without clipping the field', () => {
		const scene = stubHudScene();
		const hud = createHud(scene);
		hud.layout(390, 694);
		const resign = scene.images.find((img) => img.key === 'hudResign');
		const auto = scene.images.find((img) => img.key === 'hudAuto');
		expect(layout.hudStripInset).toBe(14);
		expect(layout.hudMoatH).toBe(0);
		expect(scene.images.some((img) => img.key === 'hudAuto')).toBe(true);
		expect(scene.images.some((img) => img.key === 'hudAi')).toBe(false);
		const y = Math.round(
			694 - layout.hudStripInset - layout.hudMoatH - layout.hudAction / 2,
		);
		expect(resign?.y).toBe(y);
		expect(auto?.y).toBe(y);
		expect(y + layout.hudAction / 2).toBe(694 - layout.hudStripInset);
		expect(
			layout.hudAction + layout.hudStripInset + layout.hudMoatH,
		).toBeLessThanOrEqual(layout.boardBottomGap);
	});

	it('arms resign on the first tap and confirms on the second within 2s', () => {
		const scene = stubHudScene();
		let resigns = 0;
		createHud(scene, {
			onResign: () => {
				resigns += 1;
			},
		});
		const resign = scene.images.find((img) => img.key === 'hudResign');
		const restY = resign?.y ?? 0;
		resign?.emit('pointerdown');
		expect(resigns).toBe(0);
		expect((resign?.y ?? 0) > restY).toBe(true);
		resign?.emit('pointerup');
		expect(resigns).toBe(0);
		expect((resign?.y ?? 0) > restY).toBe(true);
		resign?.emit('pointerdown');
		expect(resigns).toBe(1);
	});

	it('resets the resign arm after the timeout', () => {
		const scene = stubHudScene();
		let resigns = 0;
		createHud(scene, {
			onResign: () => {
				resigns += 1;
			},
		});
		const resign = scene.images.find((img) => img.key === 'hudResign');
		resign?.emit('pointerdown');
		resign?.emit('pointerup');
		flushMs(scene, resignArmMs);
		resign?.emit('pointerdown');
		expect(resigns).toBe(0);
		resign?.emit('pointerdown');
		expect(resigns).toBe(1);
	});

	it('disarms resign when auto or elsewhere is tapped', () => {
		const scene = stubHudScene();
		let resigns = 0;
		createHud(scene, {
			onResign: () => {
				resigns += 1;
			},
		});
		const resign = scene.images.find((img) => img.key === 'hudResign');
		const auto = scene.images.find((img) => img.key === 'hudAuto');
		resign?.emit('pointerdown');
		resign?.emit('pointerup');
		auto?.emit('pointerdown');
		resign?.emit('pointerdown');
		expect(resigns).toBe(0);
		flushMs(scene, 0);
		scene.emitInput('pointerdown', {}, []);
		resign?.emit('pointerdown');
		expect(resigns).toBe(0);
		resign?.emit('pointerdown');
		expect(resigns).toBe(1);
	});
});
