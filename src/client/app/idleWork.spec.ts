import { afterEach, expect, it, vi } from 'vitest';
import scene from '@/client/app/gameScene.ts?raw';
import { optionalPack, warmImages, whenIdle } from './idleWork';

/** Loose view of the global object so tests can install/remove browser APIs. */
const scope = globalThis as unknown as Record<string, unknown>;

const saved = new Map<string, { has: boolean; value: unknown }>();
for (const name of ['requestIdleCallback', 'cancelIdleCallback', 'Image']) {
	saved.set(name, { has: name in scope, value: scope[name] });
}

function install(name: string, value: unknown): void {
	if (value === undefined) delete scope[name];
	else scope[name] = value;
}

function installIdleQueue() {
	const queue = new Map<number, () => void>();
	let nextHandle = 1;
	install('requestIdleCallback', (cb: () => void) => {
		const handle = nextHandle++;
		queue.set(handle, cb);
		return handle;
	});
	install('cancelIdleCallback', (handle: number) => {
		queue.delete(handle);
	});
	return {
		/** One synchronous idle slot. */
		slot(): void {
			const entry = [...queue.entries()][0];
			if (!entry) return;
			queue.delete(entry[0]);
			entry[1]();
		},
		/** Drains idle slots across microtasks, like a browser would. */
		async drain(): Promise<void> {
			for (let i = 0; i < 50; i++) {
				if (queue.size === 0) return;
				this.slot();
				await Promise.resolve();
			}
		},
	};
}

afterEach(() => {
	for (const [name, entry] of saved) {
		if (entry.has) scope[name] = entry.value;
		else delete scope[name];
	}
});

it('uses requestIdleCallback when the browser has one and yields otherwise', async () => {
	const idle = installIdleQueue();
	let ran = 0;
	whenIdle(() => ran++);
	expect(ran).toBe(0);
	await idle.drain();
	expect(ran).toBe(1);

	install('requestIdleCallback', undefined);
	install('cancelIdleCallback', undefined);
	let fallback = 0;
	whenIdle(() => fallback++);
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(fallback).toBe(1);
});

it('cancels a queued idle task', async () => {
	const idle = installIdleQueue();
	let ran = 0;
	const cancel = whenIdle(() => ran++);
	cancel();
	await idle.drain();
	expect(ran).toBe(0);
});

it('does nothing when an image cannot be created (node / no DOM)', async () => {
	const idle = installIdleQueue();
	install('Image', undefined);
	const stop = warmImages(['/a.webp']);
	await idle.drain();
	stop();
});

it('decodes one decorative image per idle slot and honours stop', async () => {
	const idle = installIdleQueue();
	const decoded: string[] = [];
	class FakeImage {
		decoding = '';
		src = '';
		decode() {
			decoded.push(this.src);
			return Promise.resolve();
		}
	}
	install('Image', FakeImage);
	const warmed: string[] = [];
	warmImages(
		['/a.webp', '/b.webp', '/c.webp'],
		() => false,
		(url) => warmed.push(url),
	);
	await idle.drain();
	expect(decoded).toEqual(['/a.webp', '/b.webp', '/c.webp']);
	expect(warmed).toEqual(['/a.webp', '/b.webp', '/c.webp']);

	let blocked = true;
	const decodedBefore = decoded.length;
	warmImages(['/d.webp'], () => blocked);
	await idle.drain();
	expect(decoded.length).toBe(decodedBefore);
	blocked = false;
});

it('skips a failing image instead of stalling the queue', async () => {
	const idle = installIdleQueue();
	class FailImage {
		decoding = '';
		src = '';
		decode() {
			return Promise.reject(new Error('broken'));
		}
	}
	install('Image', FailImage);
	const warmed: string[] = [];
	warmImages(
		['/bad.webp', '/good.webp'],
		() => false,
		(url) => warmed.push(url),
	);
	await idle.drain();
	expect(warmed).toEqual(['/bad.webp', '/good.webp']);
});

/** The real failure the selection-overlay pack produces in a browser. */
const lazyImportFailure = () =>
	new TypeError('Failed to fetch dynamically imported module');

/**
 * Runtime is Node (vitest), but the project types do not include @types/node,
 * so reach the host process through the loosely typed global.
 */
const hostProcess = (
	globalThis as unknown as {
		process?: {
			on(event: string, listener: (reason: unknown) => void): void;
			off(event: string, listener: (reason: unknown) => void): void;
		};
	}
).process;

/** Collects Node unhandled rejections for the duration of one check. */
function watchUnhandled(): { leaks: unknown[]; stop: () => void } {
	const leaks: unknown[] = [];
	const onUnhandled = (reason: unknown) => leaks.push(reason);
	hostProcess?.on('unhandledRejection', onUnhandled);
	return {
		leaks,
		stop: () => hostProcess?.off('unhandledRejection', onUnhandled),
	};
}

it('owns a failed optional pack instead of leaking a rejection', async () => {
	expect(hostProcess).toBeDefined();
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	const watch = watchUnhandled();
	let settled: boolean | undefined;
	try {
		settled = await optionalPack('selection-overlay', async () => {
			throw lazyImportFailure();
		});
		// Microtasks that would carry an unhandled rejection have all run here.
		await new Promise((resolve) => setTimeout(resolve, 0));
	} finally {
		watch.stop();
	}
	expect(settled).toBe(false);
	expect(watch.leaks).toEqual([]);
	expect(warn).toHaveBeenCalledTimes(1);
	expect(String(warn.mock.calls[0]?.[0])).toContain('selection-overlay');
	expect(warn.mock.calls[0]?.[1]).toBeInstanceOf(TypeError);
	warn.mockRestore();
});

it('reports a failed pack to its caller without throwing', async () => {
	const seen: Array<{ label: string; error: unknown }> = [];
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	const ok = await optionalPack(
		'king-fire',
		async () => {
			throw new Error('loader exploded');
		},
		(label, error) => seen.push({ label, error }),
	);
	await optionalPack('king-fire', async () => {});
	expect(ok).toBe(false);
	const failure = seen[0];
	expect(seen).toHaveLength(1);
	expect(failure).toBeDefined();
	if (!failure) throw new Error('no failure was reported');
	expect(failure.label).toBe('king-fire');
	expect((failure.error as Error).message).toBe('loader exploded');
	// A supplied handler replaces the default warning.
	expect(warn).not.toHaveBeenCalled();
	warn.mockRestore();
});

it('keeps the warm-up behind a failed pack running, in order', async () => {
	// Mirrors scheduleResultWindow: overlay pack first, king-fire right after it.
	const order: string[] = [];
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	const watch = watchUnhandled();
	try {
		await (async () => {
			await optionalPack('selection-overlay', async () => {
				order.push('overlay');
				throw lazyImportFailure();
			});
			await optionalPack('king-fire', async () => {
				order.push('king-fire');
			});
		})();
		await new Promise((resolve) => setTimeout(resolve, 0));
	} finally {
		watch.stop();
		warn.mockRestore();
	}
	expect(order).toEqual(['overlay', 'king-fire']);
	expect(watch.leaks).toEqual([]);
});

it('isolates the overlay pack from king-fire in the scene bootstrap', () => {
	// Guard against a bare `await bootSelectionOverlay()` returning: one optional
	// pack must never cancel the other and nothing may escape as unhandled.
	const marker = 'private scheduleResultWindow(): void {';
	const from = scene.indexOf(marker);
	expect(from).toBeGreaterThan(-1);
	const to = scene.indexOf('\n	}\n', from);
	expect(to).toBeGreaterThan(from);
	const schedule = scene.slice(from, to);
	expect(schedule).toContain("optionalPack(\n				'selection-overlay'");
	expect(schedule).toContain("optionalPack('king-fire'");
	expect(schedule.indexOf("'selection-overlay'")).toBeLessThan(
		schedule.indexOf("'king-fire'"),
	);
	expect(schedule).not.toContain('await this.bootSelectionOverlay()');
	expect(schedule).not.toContain('await this.bootKingFire()');
});
