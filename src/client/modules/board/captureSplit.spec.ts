import { beforeEach, expect, it, vi } from 'vitest';

class EventEmitter {
	private listeners = new Map<string, ((...args: unknown[]) => void)[]>();
	on(name: string, fn: (...args: unknown[]) => void) {
		this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
	}
	once(name: string, fn: (...args: unknown[]) => void) {
		this.on(name, fn);
	}
	off(name: string, fn: (...args: unknown[]) => void) {
		this.listeners.set(
			name,
			this.listeners.get(name)?.filter((f) => f !== fn) ?? [],
		);
	}
	emit(name: string, ...args: unknown[]) {
		this.listeners.get(name)?.forEach((fn) => {
			fn(...args);
		});
	}
}

vi.mock('@/client/config/reliquaryLayout', () => ({
	reliquaryLayout: () => ({ originX: 0, originY: 0, cell: 44, scale: 1 }),
}));
vi.mock('phaser', () => ({
	default: {
		Textures: { FilterMode: { LINEAR: 1 } },
		Geom: {
			Rectangle: class {
				static Contains() {}
			},
		},
	},
}));
vi.mock('@/client/app/displayDensity', () => ({
	logicalSize: () => ({ width: 1024, height: 768 }),
}));

import type { IPosition, ISquare } from '@/rules';
import { createBoardView } from './createReliquaryBoardView';

function canvas() {
	const pixels = new Uint8ClampedArray(160 * 160 * 4);
	return {
		width: 160,
		height: 160,
		getContext() {
			return {
				drawImage() {
					pixels.fill(180);
				},
				getImageData() {
					return { data: pixels, width: 160, height: 160 };
				},
				createImageData(width: number, height: number) {
					return {
						data: new Uint8ClampedArray(width * height * 4),
						width,
						height,
					};
				},
				putImageData(image: { data: Uint8ClampedArray }) {
					pixels.set(image.data.subarray(0, pixels.length));
				},
			};
		},
	};
}

function harness(reduced = false) {
	vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
	vi.stubGlobal('document', {
		activeElement: null,
		createElement: (tag: string) => (tag === 'canvas' ? canvas() : {}),
		getElementById: () => null,
	});
	const objects: Record<string, unknown>[] = [];
	const tweens: Record<string, unknown>[] = [];
	const make = (x = 0, y = 0, texture = '') => {
		const state: Record<string, unknown> = {
			x,
			y,
			texture: { key: texture },
			data: {},
			visible: true,
			destroyed: false,
			children: [],
		};
		const obj: Record<string, unknown> = new Proxy(state, {
			get(target, prop) {
				if (prop in target) return target[prop as string];
				return (...args: unknown[]) => {
					if (prop === 'setTexture') target.texture = { key: args[0] };
					if (prop === 'setPosition') {
						target.x = args[0];
						target.y = args[1];
					}
					if (prop === 'setDisplaySize') {
						target.displayWidth = args[0];
						target.displayHeight = args[1];
					}
					if (prop === 'setOrigin') {
						target.originX = args[0];
						target.originY = args[1];
					}
					if (prop === 'setName') target.name = args[0];
					if (prop === 'setDepth') target.depth = args[0];
					if (prop === 'setRotation') target.rotation = args[0];
					if (prop === 'setData')
						(target.data as Record<string, unknown>)[args[0] as string] =
							args[1];
					if (prop === 'setVisible') target.visible = args[0];
					if (prop === 'setAlpha') target.alpha = args[0];
					if (prop === 'destroy') {
						target.destroyed = true;
						for (const child of target.children as { destroy: () => void }[]) {
							child.destroy();
						}
					}
					return obj;
				};
			},
		});
		objects.push(obj);
		return obj;
	};
	const events = new EventEmitter();
	const scene = {
		textures: {
			exists: () => true,
			// Faithful frame sheet: ensureBoardFrames() probes has()/add() for the
			// colour strips. Missing frames are added, so has() starts false.
			get: () => ({
				has: () => false,
				add: () => {},
				setFilter() {},
				getSourceImage: () => ({ width: 64, height: 64 }),
			}),
			addCanvas: vi.fn(),
			remove: vi.fn(),
		},
		add: {
			image: make,
			sprite: make,
			graphics: () => make(),
			tileSprite: make,
			rectangle: make,
			container: (x: number, y: number, children: unknown[]) => {
				const group = make(x, y);
				group.children = children;
				return group;
			},
		},
		game: {
			canvas: {
				getAttribute: () => null,
				setAttribute() {},
				removeAttribute() {},
				addEventListener() {},
				removeEventListener() {},
			},
		},
		tweens: {
			killTweensOf: vi.fn(),
			add: (tween: Record<string, unknown>) => {
				tweens.push(tween);
				return tween;
			},
		},
		events,
	};
	const board = createBoardView(scene as never, () => {});
	const finishHop = () => {
		const move = tweens.find(
			(tween) =>
				(tween.targets as { name?: string }).name === 'selection-piece-group' &&
				!tween.done,
		);
		expect(move).toBeTruthy();
		move!.done = true;
		(move!.onComplete as () => void)();
	};
	return { board, objects, tweens, finishHop };
}

const at = (row: number, col: number): ISquare => ({ row, col });

function position(): IPosition {
	const squares: IPosition['squares'] = Array.from({ length: 8 }, () =>
		Array(8).fill(null),
	);
	squares[2][0] = { kind: 'man', side: 'white' };
	squares[3][1] = { kind: 'man', side: 'black' };
	squares[3][3] = { kind: 'man', side: 'black' };
	return { squares, turn: 'white' };
}

const pieceAt = (h: ReturnType<typeof harness>, square: ISquare) =>
	h.objects.filter(
		(obj) =>
			obj.name === 'selection-piece' &&
			!obj.destroyed &&
			(obj.data as { square?: ISquare }).square?.row === square.row &&
			(obj.data as { square?: ISquare }).square?.col === square.col,
	);

beforeEach(() => vi.unstubAllGlobals());

it('cuts only the victim of the hop that just landed, then the next one', () => {
	const h = harness();
	const from = at(2, 0);
	const first = at(3, 1);
	const second = at(3, 3);
	h.board.sync(position(), [from], from);
	h.board.playMove({ from, path: [at(4, 2), at(2, 4)] }, () => {});
	expect(h.objects.filter((obj) => obj.name === 'capture-half')).toHaveLength(
		0,
	);
	expect(pieceAt(h, first)).toHaveLength(1);
	expect(pieceAt(h, second)).toHaveLength(1);
	h.finishHop();
	expect(pieceAt(h, first)).toHaveLength(0);
	expect(pieceAt(h, second)).toHaveLength(1);
	const halves = h.objects.filter(
		(obj) => obj.name === 'capture-half' && !obj.destroyed,
	);
	expect(halves).toHaveLength(2);
	const falls = h.tweens.filter(
		(tween) =>
			(tween.targets as { name?: string }).name === 'capture-half' &&
			tween.x != null,
	);
	expect(falls).toHaveLength(2);
	expect(Number(falls[0]!.x)).not.toBeCloseTo(Number(falls[1]!.x));
	expect(Number(falls[0]!.y)).toBeGreaterThan((7.5 - 3) * 44);
	expect(Number(falls[1]!.y)).toBeGreaterThan((7.5 - 3) * 44);
	expect(
		h.objects.some((obj) => obj.name === 'capture-cut' && !obj.destroyed),
	).toBe(true);
	h.finishHop();
	expect(pieceAt(h, second)).toHaveLength(0);
	expect(h.objects.filter((obj) => obj.name === 'capture-half')).toHaveLength(
		4,
	);
});

it('does not bring a cut piece back while the chain position still lists it', () => {
	const h = harness();
	const from = at(2, 0);
	const first = at(3, 1);
	h.board.sync(position(), [from], from);
	h.board.playMove(
		{ from, path: [at(4, 2)] },
		() => {},
		undefined,
		undefined,
		true,
	);
	h.finishHop();
	expect(pieceAt(h, first)).toHaveLength(0);
	h.board.sync(position(), [at(4, 2)], at(4, 2));
	expect(pieceAt(h, first)).toHaveLength(0);
	expect(
		h.objects.filter((obj) => obj.name === 'capture-half' && !obj.destroyed),
	).toHaveLength(2);
});

it('reduced motion removes the captured piece without halves', () => {
	const h = harness(true);
	const from = at(2, 0);
	h.board.sync(position(), [from], from);
	h.board.playMove({ from, path: [at(4, 2), at(2, 4)] }, () => {});
	expect(h.tweens).toHaveLength(0);
	expect(h.objects.filter((obj) => obj.name === 'capture-half')).toHaveLength(
		0,
	);
	expect(pieceAt(h, at(3, 1))).toHaveLength(0);
	expect(pieceAt(h, at(3, 3))).toHaveLength(0);
});
