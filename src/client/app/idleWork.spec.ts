import { afterEach, expect, it } from 'vitest';
import { warmImages, whenIdle } from './idleWork';

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
