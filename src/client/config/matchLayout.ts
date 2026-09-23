import { computeFieldLayout } from './fieldLayout';
export type SafeInsets = {
	top: number;
	bottom: number;
	left: number;
	right: number;
};
const zero = { top: 0, bottom: 0, left: 0, right: 0 };
export const matchRailReservePx = 64;
export const compactHudHeight = 136;
export const compactHudGap = 8;
/** Portrait is width-bound, so spare height must not become a void above the board. */
export const compactPortraitTopInset = 12;

export function matchRailBottom(): number {
	if (typeof document === 'undefined') return 0;
	const rail = document.getElementById('match-rail');
	if (!rail || rail.hidden) return 0;
	if (window.innerWidth < 760 || window.innerHeight <= 500) return 0;
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
/** Keep existing field scale whenever side bays fit; otherwise maximize field after readable bays. */
export function matchLayout(
	width: number,
	height: number,
	safe: SafeInsets = zero,
) {
	const w = width - safe.left - safe.right,
		h = height - safe.top - safe.bottom;
	// Mobile: one bottom strip, never side bays that consume board width.
	if (width < 760 || height <= 500) {
		const fieldSize = Math.max(8, Math.min(w - 38, Math.floor((w * 352) / 380), Math.floor((h - compactHudHeight - compactHudGap - 16) * 352 / 418)));
		const scale = fieldSize / 352;
		const boardHeight = 418 * scale;
		const spare = Math.max(0, h - boardHeight - compactHudGap - compactHudHeight);
		const portrait = h > w;
		// Keep the HUD against the board. Portrait pins the group under a small
		// inset; leftover height sits below, not as a void above the squares.
		const topInset = portrait ? Math.min(compactPortraitTopInset, spare) : spare / 2;
		const boardY = safe.top + topInset;
		const stripY = boardY + boardHeight + compactHudGap;
		return {
			portrait: h > w, fieldSize, scale, cell: fieldSize / 8,
			originX: safe.left + (w - fieldSize) / 2,
			originY: boardY + 33 * scale,
			foe: { x: safe.left + 8, y: stripY },
			you: { x: safe.left + 8, y: stripY + 52 },
			panelScale: 1, mode: 'compact' as const,
		};
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
	const gap = 20;
	let fieldSize = native,
		panelScale = Math.min(1, (w - 16) / 374),
		mode: 'sides' | 'top-bottom' | 'above' = 'top-bottom';
	const sideScale = Math.min(
		1,
		((w - (380 * native) / 352) / 2 - gap - 8) / 374,
	);
	if (w > h && sideScale >= 0.85) {
		mode = 'sides';
		panelScale = sideScale;
	} else if (w >= 760) {
		mode = 'above';
		panelScale = Math.min(1, (w - 36) / 748);
		fieldSize = Math.min(
			native,
			Math.floor(((h - 32 - 128 * panelScale - gap) * 352) / 418),
		);
	} else {
		fieldSize = Math.min(
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
	}
	fieldSize = Math.max(8, fieldSize);
	const scale = fieldSize / 352,
		bh = 418 * scale,
		bw = 380 * scale,
		pw = 374 * panelScale,
		ph = 128 * panelScale;
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
		const y = safe.top + (h - bh - 2 * gap - 2 * ph) / 2;
		boardY = y + ph + gap;
		foe = { x: cx - pw / 2, y };
		you = { x: foe.x, y: boardY + bh + gap };
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
