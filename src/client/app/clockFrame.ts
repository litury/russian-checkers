/** Approved C ornament: 140×79 around the 104×49 digit window. Existing PNG layers only. */
export const clockFrame = {
	x: 223,
	y: 14,
	width: 140,
	height: 79,
	enterMs: 420,
	exitMs: 320,
};

/** Frame runs only after bunker doors finished and only on the side to move. */
export function clockFrameWanted(
	doors: number,
	lift: number,
	active: boolean,
	preparing: boolean,
): boolean {
	return active && !preparing && doors >= 181 && lift <= 0;
}

export function clockFrameStep(
	current: number,
	want: boolean,
	dt: number,
	reduced: boolean,
): number {
	if (reduced) return want ? 1 : 0;
	const target = want ? 1 : 0;
	if (current === target) return current;
	const dur = want ? clockFrame.enterMs : clockFrame.exitMs;
	const dir = target > current ? 1 : -1;
	return Math.max(0, Math.min(1, current + (dir * Math.max(0, dt)) / dur));
}

/** Crossfade existing C / amber / lights. Metal first on enter, glow first off on exit. */
export function clockFrameAlphas(
	amt: number,
	reduced: boolean,
	pulse: number,
): { metal: number; amber: number; lights: number } {
	if (amt <= 0) return { metal: 0, amber: 0, lights: 0 };
	if (reduced) return { metal: 0, amber: amt, lights: 0 };
	const metal = Math.min(1, amt / 0.45);
	const glow = Math.max(0, (amt - 0.35) / 0.65);
	return { metal, amber: glow, lights: glow * pulse };
}
