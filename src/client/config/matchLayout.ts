import { computeFieldLayout } from './fieldLayout';
export type SafeInsets = {
	top: number;
	bottom: number;
	left: number;
	right: number;
};
const zero = { top: 0, bottom: 0, left: 0, right: 0 };
export const matchRailReservePx = 64;
/** Approved clock ornament. Fit is checked against content width; no side column. */
export const clockFrameWidthPx = 140;
const panelNativeW = 374;
const panelNativeH = 128;
const gap = 20;
const mobileTopInsetPx = 12;

export function matchRailBottom(): number {
	if (typeof document === 'undefined') return 0;
	const rail = document.getElementById('match-rail');
	if (!rail || rail.hidden) return 0;
	return matchRailReservePx;
}

export function readSafeInsets(): SafeInsets {
	if (typeof document === 'undefined') return zero;
	const el = document.createElement('div');
	el.style.cssText =
		'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
	document.body.append(el);
	const css = getComputedStyle(el);
	const result = {
		top: parseFloat(css.paddingTop) || 0,
		bottom: (parseFloat(css.paddingBottom) || 0) + matchRailBottom(),
		left: parseFloat(css.paddingLeft) || 0,
		right: parseFloat(css.paddingRight) || 0,
	};
	el.remove();
	return result;
}

/** cb79ba6 top-bottom field, before the compact strip and the right-column reserve. */
function baselineTopBottom(w: number, h: number) {
	const original = computeFieldLayout(w, h);
	const native = Math.max(
		8,
		Math.min(
			w - 38,
			Math.floor((w * 352) / 380),
			Math.floor((h * 352) / 418),
			original.fieldSize - (original.portrait ? 0 : 66),
		),
	);
	let panelScale = Math.min(1, (w - 16) / panelNativeW);
	let fieldSize = Math.min(
		native,
		Math.floor(((h - 24 - 256 * panelScale - 2 * gap) * 352) / 418),
	);
	if (fieldSize < 352) {
		const budget = h - 24 - 2 * gap;
		const need = Math.ceil((352 * 418) / 352);
		panelScale = Math.min(panelScale, Math.max(0.45, (budget - need) / 256));
		fieldSize = Math.min(
			native,
			Math.floor(((h - 24 - 256 * panelScale - 2 * gap) * 352) / 418),
		);
	}
	return { fieldSize: Math.max(8, fieldSize), panelScale };
}

function placeTopBottom(
	safe: SafeInsets,
	w: number,
	h: number,
	fieldSize: number,
	panelScale: number,
) {
	const scale = fieldSize / 352;
	const bh = 418 * scale;
	const room = h - 24 - bh - 2 * gap;
	// Timers give up height. The locked field does not.
	if (panelNativeH * 2 * panelScale > room)
		panelScale = Math.max(0.01, room / (panelNativeH * 2));
	const widthScale = Math.min(1, (w - 16) / panelNativeW);
	panelScale = Math.min(panelScale, widthScale);
	const pw = panelNativeW * panelScale;
	const ph = panelNativeH * panelScale;
	const spare = Math.max(0, h - (2 * ph + 2 * gap + bh));
	const topInset = h > w ? Math.min(mobileTopInsetPx, spare) : spare / 2;
	const boardY = safe.top + topInset + ph + gap;
	const x = safe.left + Math.max(0, (w - pw) / 2);
	return {
		portrait: h > w,
		fieldSize,
		scale,
		cell: fieldSize / 8,
		originX: safe.left + (w - fieldSize) / 2,
		originY: boardY + 33 * scale,
		foe: { x, y: safe.top + topInset },
		you: { x, y: boardY + bh + gap },
		panelScale,
		mode: 'top-bottom' as const,
	};
}

/** Keep existing field scale whenever side bays fit; otherwise maximize field after readable bays. */
export function matchLayout(
	width: number,
	height: number,
	safe: SafeInsets = zero,
) {
	const w = width - safe.left - safe.right,
		h = height - safe.top - safe.bottom;
	// Phone and short landscape: foe above, you below. Buttons stay in CSS.
	if (width < 760 || height <= 500) {
		const base = baselineTopBottom(w, h);
		return placeTopBottom(safe, w, h, base.fieldSize, base.panelScale);
	}
	const original = computeFieldLayout(w, h);
	const native = Math.max(
		8,
		Math.min(
			w - 38,
			Math.floor((w * 352) / 380),
			Math.floor((h * 352) / 418),
			original.fieldSize - (original.portrait ? 0 : 66),
		),
	);
	let fieldSize = native,
		panelScale = Math.min(1, (w - 16) / panelNativeW),
		mode: 'sides' | 'top-bottom' | 'above' = 'top-bottom';
	const sideScale = Math.min(
		1,
		((w - (380 * native) / 352) / 2 - gap - 8) / panelNativeW,
	);
	if (w > h && sideScale >= 0.85) {
		mode = 'sides';
		panelScale = sideScale;
	} else if (w >= 760) {
		mode = 'above';
		panelScale = Math.min(1, (w - 36) / 748);
		fieldSize = Math.min(
			native,
			Math.floor(((h - 32 - panelNativeH * panelScale - gap) * 352) / 418),
		);
	} else {
		const base = baselineTopBottom(w, h);
		fieldSize = base.fieldSize;
		panelScale = base.panelScale;
	}
	fieldSize = Math.max(8, fieldSize);
	const scale = fieldSize / 352,
		bh = 418 * scale,
		bw = 380 * scale,
		pw = panelNativeW * panelScale,
		ph = panelNativeH * panelScale;
	let boardY: number,
		foe: { x: number; y: number },
		you: { x: number; y: number };
	const cx = safe.left + w / 2;
	if (mode === 'sides') {
		boardY = safe.top + (h - bh) / 2;
		foe = { x: cx - bw / 2 - gap - pw, y: safe.top + (h - ph) / 2 };
		you = { x: cx + bw / 2 + gap, y: foe.y };
	} else if (mode === 'above') {
		const y = safe.top + (h - bh - gap - ph) / 2;
		boardY = y + ph + gap;
		foe = { x: cx - pw - 10, y };
		you = { x: cx + 10, y };
	} else {
		return placeTopBottom(safe, w, h, fieldSize, panelScale);
	}
	return {
		portrait: h > w,
		fieldSize,
		scale,
		cell: fieldSize / 8,
		originX: cx - fieldSize / 2,
		originY: boardY + 33 * scale,
		foe,
		you,
		panelScale,
		mode,
	};
}
