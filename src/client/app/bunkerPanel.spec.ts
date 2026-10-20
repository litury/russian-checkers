import type Phaser from 'phaser';
import { afterEach, expect, it, vi } from 'vitest';
import { createBunkerPanel } from './bunkerPanel';

afterEach(() => vi.unstubAllGlobals());

it.each([true, false])(
	'shows only the opponent name (own=%s)',
	(own) => {
		vi.stubGlobal('document', {});
		const texts: { text: string; scaleX: number; scaleY: number }[] = [];
		const skins: { scaleX: number; scaleY: number }[] = [];
		const frames: { scaleX: number; scaleY: number }[] = [];
		const object = (content = '') => {
			const target = {
				text: content,
				x: 0,
				y: 0,
				width: 50,
				height: 20,
				scaleX: 1,
				scaleY: 1,
			};
			const go = new Proxy(target, {
				get(value, key) {
					if (key in value) return value[key as keyof typeof value];
					return (...args: unknown[]) => {
						if (key === 'setText') value.text = String(args[0]);
						if (key === 'setScale') {
							value.scaleX = Number(args[0]);
							value.scaleY = Number(args[1] ?? args[0]);
						}
						if (key === 'setSize') {
							value.width = Number(args[0]);
							value.height = Number(args[1]);
						}
						return go;
					};
				},
			});
			return go;
		};
		const scene = {
			add: {
				container: () => object(),
				image: (_x: number, _y: number, _texture: string, frame: string) => {
					const go = object();
					if (frame.startsWith('frame-')) frames.push(go);
					return go;
				},
				nineslice: () => {
					const go = object();
					skins.push(go);
					return go;
				},
				sprite: () => object(),
				text: (_x: number, _y: number, content: string) => {
					const go = object(content);
					texts.push(go);
					return go;
				},
			},
			events: { on: vi.fn(), once: vi.fn() },
		};
		const panel = createBunkerPanel(scene as unknown as Phaser.Scene, own);
		expect(texts[1].text).toBe(own ? '' : 'Бот');
		panel.setName('Ты');
		expect(texts[1].text).toBe(own ? '' : 'Ты');
		panel.setName('Александр');
		expect(texts[1].text).toBe(own ? '' : 'Александр');
		panel.setStatus('Ход соперника');
		panel.pose(2800, true);
		expect(texts.some(({ text }) => text.includes('ВАША СТОРОНА'))).toBe(false);
		if (own)
			expect(texts.some(({ text }) => text === 'Ход соперника')).toBe(true);
		if (own) {
			panel.layout(2, 480, 0.99, 0.5);
			expect(texts[1]).toMatchObject({ y: 12 });
			expect(texts[2]).toMatchObject({ y: 34 });
			expect(texts[texts.length - 1]).toMatchObject({ y: 82 });
			panel.layout(2, 540, 1, 1);
			expect(texts[1]).toMatchObject({ x: 20, y: 16 });
			expect(texts[2]).toMatchObject({ y: 39 });
			expect(texts[texts.length - 1]).toMatchObject({ x: 57, y: 89 });
		} else {
			panel.layout(2, 4, 0.99, 0.5);
			expect(texts[0]).toMatchObject({ y: 16 });
			expect(texts[1]).toMatchObject({ y: 46 });
			expect(texts[2]).toMatchObject({ y: 34 });
			panel.layout(2, 4, 1, 1);
			expect(texts[0]).toMatchObject({ y: 26 });
			expect(texts[1]).toMatchObject({ y: 46 });
			expect(texts[2]).toMatchObject({ y: 39 });
		}
		for (const [scaleX, scaleY] of [
			[2, 1],
			[0.99, 0.5],
			[1, 1],
		]) {
			panel.layout(2, 4, scaleX, scaleY);
			for (const go of [
				...texts.filter(({ text }) => text),
				...frames,
				...skins,
			]) {
				expect(go.scaleX * scaleX).toBeCloseTo(go.scaleY * scaleY);
			}
		}
		expect(skins).toHaveLength(6);
		expect(frames).toHaveLength(12);
	},
);
