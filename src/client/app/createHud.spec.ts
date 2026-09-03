import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { createHud } from './createHud';

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

function stubHudScene(): Phaser.Scene & {
	rects: StubGo[];
	images: StubGo[];
} {
	const rects: StubGo[] = [];
	const images: StubGo[] = [];
	return {
		rects,
		images,
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
			on() {},
		},
		time: {
			delayedCall() {
				return {};
			},
		},
		tweens: {
			killTweensOf() {},
			add() {
				return {};
			},
		},
	} as unknown as Phaser.Scene & { rects: StubGo[]; images: StubGo[] };
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
		expect(menuIcon.key).toBe('hudMenuOpen');
		expect(menuIcon.scaleY).toBe(1);
		menuHit.emit('pointerdown', { id: 2 });
		expect(chrome?.visible).toBe(false);
		expect(menuIcon.key).toBe('hudMenuPress');
		menuHit.emit('pointerup', { id: 2 });
		expect(menuIcon.key).toBe('hudMenu');
		expect(menuIcon.scaleY).toBe(1);
		expect(menuIcon.y).toBe(0);
	});
});
