import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { createHud } from './createHud';

type Handler = (...args: unknown[]) => void;

type StubGo = {
	visible: boolean;
	setDepth: () => StubGo;
	setVisible: (value: boolean) => StubGo;
	setPosition: () => StubGo;
	setDisplaySize: () => StubGo;
	setInteractive: () => StubGo;
	disableInteractive: () => StubGo;
	setOrigin: () => StubGo;
	setStroke: () => StubGo;
	setText: () => StubGo;
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
		setStroke() {
			return go;
		},
		setText() {
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

function stubHudScene(): Phaser.Scene & {
	rects: StubGo[];
	graphics: StubGo[];
} {
	const rects: StubGo[] = [];
	const graphics: StubGo[] = [];
	return {
		rects,
		graphics,
		add: {
			text: () => stubGo(),
			image: () => stubGo(),
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
	} as unknown as Phaser.Scene & { rects: StubGo[]; graphics: StubGo[] };
}

describe('createHud', () => {
	it('opens the Phaser sfx panel from the hud menu', () => {
		const scene = stubHudScene();
		createHud(scene);
		const menuHit = scene.rects[0];
		const [g] = scene.graphics;
		expect(g.visible).toBe(false);
		menuHit.emit('pointerdown');
		expect(g.visible).toBe(true);
		menuHit.emit('pointerdown');
		expect(g.visible).toBe(false);
	});
});
