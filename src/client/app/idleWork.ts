/**
 * Decorative work that must never sit on the match-start path.
 *
 * Everything here runs in browser idle time and yields between items, so a
 * reveal animation or a move animation keeps the main thread.
 */
type IdleScope = typeof globalThis & {
	requestIdleCallback?: (
		callback: (deadline: { timeRemaining(): number }) => void,
		options?: { timeout: number },
	) => number;
	cancelIdleCallback?: (handle: number) => void;
};

/** Runs `task` at the next idle moment; the returned function cancels it. */
export function whenIdle(task: () => void, timeoutMs = 2000): () => void {
	const scope = globalThis as IdleScope;
	if (typeof scope.requestIdleCallback === 'function') {
		const handle = scope.requestIdleCallback(() => task(), {
			timeout: timeoutMs,
		});
		return () => scope.cancelIdleCallback?.(handle);
	}
	const handle = setTimeout(task, 0) as unknown as number;
	return () => clearTimeout(handle);
}

/**
 * Decodes decorative images one per idle slot. Never throws, never blocks:
 * a failed or slow image is simply skipped, and `shouldStop` (page change,
 * match over) ends the queue early. Returns a cancel function.
 */
export function warmImages(
	urls: readonly string[],
	shouldStop: () => boolean = () => false,
	onWarm?: (url: string) => void,
): () => void {
	const queue = [...urls];
	let stopped = false;
	const step = (): void => {
		if (stopped || shouldStop()) return;
		const url = queue.shift();
		if (url === undefined) return;
		if (typeof Image !== 'function') return;
		const image = new Image();
		image.decoding = 'async';
		image.src = url;
		const next = (): void => {
			if (!stopped) onWarm?.(url);
			whenIdle(step);
		};
		try {
			if (typeof image.decode === 'function')
				void image.decode().then(next, next);
			else {
				image.onload = next;
				image.onerror = next;
			}
		} catch {
			next();
		}
	};
	whenIdle(step);
	return () => {
		stopped = true;
	};
}
