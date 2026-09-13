import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import {
	applyDisplayDensity,
	densityDimensions,
	installDisplayDensity,
	logicalSize,
} from './displayDensity';

it('falls back to 1 for unavailable DPR or a framebuffer beyond the GPU limit', () => {
	expect(densityDimensions(390, 844, NaN).density).toBe(1);
	expect(densityDimensions(1280, 720, 2, 2048).density).toBe(1);
});

it('resizes through ScaleManager once, preserves logical layout and never compounds camera zoom', () => {
	const camera = {
		setViewport: vi.fn().mockReturnThis(),
		setOrigin: vi.fn().mockReturnThis(),
		setZoom: vi.fn().mockReturnThis(),
		setScroll: vi.fn().mockReturnThis(),
	};
	const scale = {
		width: 1280,
		height: 720,
		zoom: 1,
		setZoom: vi.fn(),
		resize: vi.fn(),
	};
	const scene = { scale, cameras: { main: camera } } as unknown as Phaser.Scene;
	applyDisplayDensity(scene, 390, 844, 2);
	expect(scale.setZoom).toHaveBeenCalledWith(0.5);
	expect(scale.resize).toHaveBeenCalledWith(780, 1688);
	expect(scale.resize.mock.invocationCallOrder[0]).toBeLessThan(
		scale.setZoom.mock.invocationCallOrder[0],
	);
	expect(logicalSize(scene)).toEqual({ width: 390, height: 844 });
	applyDisplayDensity(scene, 390, 844, 2);
	expect(scale.resize).toHaveBeenCalledTimes(1);
	applyDisplayDensity(scene, 844, 390, 3);
	expect(camera.setZoom).toHaveBeenLastCalledWith(2);
	expect(scale.resize).toHaveBeenLastCalledWith(1688, 780);
	applyDisplayDensity(scene, 1280, 720, 1);
	expect(camera.setZoom).toHaveBeenLastCalledWith(1);
	expect(logicalSize(scene)).toEqual({ width: 1280, height: 720 });
});

it('observes CSS viewport and DPR changes and releases listeners on shutdown', () => {
	const win = {
		devicePixelRatio: 2,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		matchMedia: vi.fn(() => ({
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})),
	};
	const disconnect = vi.fn();
	vi.stubGlobal('window', win);
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe = vi.fn();
			disconnect = disconnect;
		},
	);
	const camera = {
		setViewport: vi.fn().mockReturnThis(),
		setOrigin: vi.fn().mockReturnThis(),
		setZoom: vi.fn().mockReturnThis(),
		setScroll: vi.fn().mockReturnThis(),
	};
	const parent = { clientWidth: 390, clientHeight: 844 };
	const events = { once: vi.fn(), on: vi.fn(), off: vi.fn() };
	const scene = {
		scale: { width: 390, height: 844, setZoom: vi.fn(), resize: vi.fn() },
		cameras: { main: camera },
		game: {
			canvas: { parentElement: parent, style: {} },
			renderer: {
				gl: {
					MAX_TEXTURE_SIZE: 1,
					MAX_RENDERBUFFER_SIZE: 2,
					getParameter: () => 4096,
				},
			},
		},
		events,
	} as unknown as Phaser.Scene;
	const layout = vi.fn();
	installDisplayDensity(scene, layout);
	expect(layout).toHaveBeenLastCalledWith(390, 844);
	expect(camera.setZoom).toHaveBeenLastCalledWith(2);
	expect(events.once).toHaveBeenCalledWith('shutdown', expect.any(Function));
	const resize = win.addEventListener.mock.calls.find(
		(c) => c[0] === 'resize',
	)?.[1];
	parent.clientWidth = 844;
	parent.clientHeight = 390;
	resize();
	expect(layout).toHaveBeenLastCalledWith(844, 390);
	expect(events.on).toHaveBeenCalledWith('preupdate', expect.any(Function));
	win.devicePixelRatio = 1;
	events.on.mock.calls[0][1]();
	expect(camera.setZoom).toHaveBeenLastCalledWith(1);
	events.once.mock.calls[0][1]();
	expect(events.off).toHaveBeenCalledWith(
		'preupdate',
		events.on.mock.calls[0][1],
	);
	expect(disconnect).toHaveBeenCalledTimes(1);
	expect(win.removeEventListener).toHaveBeenCalledWith('resize', resize);
	expect(logicalSize(scene)).toEqual({ width: 390, height: 844 });
	vi.unstubAllGlobals();
});

describe('densityDimensions', () => {
	it('caps DPR while preserving logical viewport dimensions', () => {
		expect(densityDimensions(390, 844, 3)).toEqual({
			width: 390,
			height: 844,
			density: 2,
			backingWidth: 780,
			backingHeight: 1688,
		});
	});
});
