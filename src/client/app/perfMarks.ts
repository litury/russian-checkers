/**
 * Startup performance marks for the first-match path.
 *
 * Marks are idempotent (a repeated mark never moves the timeline) and mirrored
 * into `window.__damkaPerf` so QA can read the first-frame/input timeline without
 * scraping the console. The bridge lives on `globalThis`, so the same code runs
 * under the node test environment.
 */
export type PerfMarkName =
	| 'play-intent'
	| 'play-handled'
	| 'playfield-ready'
	| 'board-first-frame'
	| 'counting-in-false'
	| 'first-move-allowed'
	| 'first-move-played';

export type PerfBridge = {
	marks: Partial<Record<PerfMarkName, number>>;
	measures: Record<string, number>;
};

/** Derived durations published alongside the raw marks (ms, three decimals). */
const PAIRS: [string, PerfMarkName, PerfMarkName][] = [
	['play-input-delay', 'play-intent', 'play-handled'],
	['play-intent-to-playfield-ready', 'play-intent', 'playfield-ready'],
	['play-intent-to-board-first-frame', 'play-intent', 'board-first-frame'],
	['play-intent-to-first-move-allowed', 'play-intent', 'first-move-allowed'],
	[
		'playfield-ready-to-board-first-frame',
		'playfield-ready',
		'board-first-frame',
	],
	[
		'board-first-frame-to-first-move-allowed',
		'board-first-frame',
		'first-move-allowed',
	],
	['play-intent-to-first-move-played', 'play-intent', 'first-move-played'],
	[
		'first-move-allowed-to-first-move-played',
		'first-move-allowed',
		'first-move-played',
	],
];

const PREFIX = 'damka:';

declare global {
	interface Window {
		__damkaPerf?: PerfBridge;
	}
}

function scope(): { __damkaPerf?: PerfBridge } {
	return globalThis as { __damkaPerf?: PerfBridge };
}

function bridge(): PerfBridge {
	const root = scope();
	if (!root.__damkaPerf) root.__damkaPerf = { marks: {}, measures: {} };
	return root.__damkaPerf;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

function recompute(next: PerfMarkName): void {
	const state = bridge();
	for (const [name, from, to] of PAIRS) {
		if (from !== next && to !== next) continue;
		const start = state.marks[from];
		const end = state.marks[to];
		if (start === undefined || end === undefined) continue;
		state.measures[name] = round(end - start);
	}
}

/** First write wins. Returns the recorded timestamp (ms since time origin). */
export function markPerf(name: PerfMarkName, at?: number): number {
	const state = bridge();
	const known = state.marks[name];
	if (known !== undefined) return known;
	const stamped =
		typeof at === 'number' && Number.isFinite(at) ? at : performance.now();
	state.marks[name] = round(stamped);
	try {
		if (typeof at === 'number' && Number.isFinite(at))
			performance.mark(PREFIX + name, { startTime: stamped });
		else performance.mark(PREFIX + name);
	} catch {
		// User Timing unavailable (older WebView): the bridge stays the source of truth.
	}
	recompute(name);
	return state.marks[name] as number;
}

export function readPerf(): PerfBridge {
	const state = bridge();
	return { marks: { ...state.marks }, measures: { ...state.measures } };
}

/**
 * Records a mark whose moment already happened (for example a click's
 * `event.timeStamp`), so input delay is not hidden by a busy main thread.
 * Non-finite or future values are ignored, and the first write still wins.
 */
export function markPerfAt(name: PerfMarkName, at: number): number {
	if (!Number.isFinite(at) || at < 0) return markPerf(name);
	const now = performance.now();
	return markPerf(name, Math.min(at, now));
}

/** QA seam: start a fresh cold/warm timeline without reloading the page. */
export function resetPerf(): void {
	scope().__damkaPerf = { marks: {}, measures: {} };
}
