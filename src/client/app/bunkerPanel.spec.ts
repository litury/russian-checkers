import type Phaser from 'phaser';
import { afterEach, expect, it, vi } from 'vitest';
import { createBunkerPanel } from './bunkerPanel';

afterEach(() => vi.unstubAllGlobals());

it.each([true, false])(
	'keeps player names without a side badge (own=%s)',
	(own) => {
		vi.stubGlobal('document', {});
		const texts: { text: string }[] = [];
		const object = (content = '') => {
			const target = { text: content, x: 0, y: 0, width: 50, height: 20 };
			const go = new Proxy(target, {
				get(value, key) {
					if (key in value) return value[key as keyof typeof value];
					return (...args: unknown[]) => {
						if (key === 'setText') value.text = String(args[0]);
						return go;
					};
				},
			});
			return go;
		};
		const scene = {
			add: {
				container: () => object(),
				image: () => object(),
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
		expect(texts[1].text).toBe(own ? 'Ты' : 'Бот');
		panel.setName('Александр');
		expect(texts[1].text).toBe('Александр');
		panel.setStatus('Ход соперника');
		panel.pose(2800, true);
		expect(texts.some(({ text }) => text.includes('ВАША СТОРОНА'))).toBe(false);
		if (own)
			expect(texts.some(({ text }) => text === 'Ход соперника')).toBe(true);
	},
);
