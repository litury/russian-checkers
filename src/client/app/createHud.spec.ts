import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { layout } from '@/client/config/layout';
import { createHud } from './createHud';

type Handler = (...args: unknown[]) => void;

type StubGo = {
	visible: boolean;
	key?: string;
	scaleY: number;
	setDepth: () => StubGo;
	setVisible: (value: boolean) => StubGo;
	setPosition: () => StubGo;
	setDisplaySize: () => StubGo;
	setInteractive: () => StubGo;
	disableInteractive: () => StubGo;
	setOrigin: () => StubGo;
	setScale: (x: number, y: number) => StubGo;
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
			return go;
		},
		disableInteractive() {
			return go;
		},
		setOrigin() {
			return go;
		},
		setScale(_x: number, y: number) {
			go.scaleY = y;
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
	it('opens the result CRT sfx panel from the hud menu and keeps it pressed', () => {
		const scene = stubHudScene();
		createHud(scene);
		const menuHit = scene.rects[0];
		const menuIcon = scene.images[0];
		const chrome = scene.images.find((img) => img.key === 'resultMonitor');
		expect(menuIcon.key).toBe('hudMenu');
		expect(chrome?.visible).toBe(false);
		expect(scene.images.some((img) => img.key === 'hudEvmPanel')).toBe(false);
		menuHit.emit('pointerdown', { id: 1 });
		expect(chrome?.visible).toBe(true);
		expect(menuIcon.scaleY).toBe(layout.pressScaleY);
		menuHit.emit('pointerdown', { id: 2 });
		expect(chrome?.visible).toBe(false);
		expect(menuIcon.scaleY).toBe(1);
	});
});
