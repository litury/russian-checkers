/**
 * Focus-ring ownership: a visible ring belongs to the keyboard and to assistive
 * technology (screen readers, scripted focus) — never to a finger.
 *
 * Some mobile engines keep `:focus-visible` matched on the element a tap
 * focused, so the engine heuristic alone is not enough and the outline has to
 * be gated in CSS. That gate must belong to the element the pointer gesture
 * actually focused: a global "last input was a pointer" flag stays true until
 * the next keydown, which also suppresses every later non-pointer focus
 * (screen reader, `element.focus()`), leaving those users without a ring.
 *
 * So instead of a sticky global mode we mark the one element a pointer press
 * focused with `data-pointer-focus`, and drop the mark as soon as focus leaves
 * it or moves on without a pointer. CSS then removes the outline for the
 * marked element only.
 */
export const POINTER_FOCUS_ATTR = 'data-pointer-focus';

/** Elements a tap can hand focus to (or that forward it to a control). */
export const FOCUSABLE_SELECTOR =
	'button,input,select,textarea,summary,a[href],[tabindex]:not([tabindex="-1"])';

export type FocusRingElement = {
	closest(selector: string): FocusRingElement | null;
	contains(other: FocusRingElement): boolean;
	setAttribute(name: string, value: string): void;
	removeAttribute(name: string): void;
	hasAttribute(name: string): boolean;
};

const focusOwnerOf = (
	target: FocusRingElement | null,
): FocusRingElement | null => target?.closest(FOCUSABLE_SELECTOR) ?? null;

/**
 * Did `focused` take focus because the pointer went down on `target`?
 * Tapping a `<label>` (or text inside a button) forwards focus to another
 * element, so containment inside a label counts as well. A plain container —
 * page background, overlay — owns nothing: a later scripted focus of a button
 * on top of it is not pointer focus.
 */
export function pointerOwnsFocus(
	target: FocusRingElement | null,
	focused: FocusRingElement | null,
): boolean {
	if (!target || !focused) return false;
	if (focusOwnerOf(target) === focused) return true;
	const label = target.closest('label');
	return !!label && label.contains(focused);
}

/**
 * Marks the element focused by a pointer gesture. Pure state: it never touches
 * the document, so the decision is testable without a DOM.
 */
export class FocusRingState {
	private marked: FocusRingElement | null = null;

	private pointerTarget: FocusRingElement | null = null;

	/** The element that currently holds focus, if any. */
	private focused: FocusRingElement | null = null;

	/** A pointer press landed on `target`. */
	pointerDown(target: FocusRingElement | null): void {
		this.pointerTarget = target;
		// A touch anywhere else revokes the previous tap's ring immediately:
		// the engine may keep the old element focused and still matching
		// `:focus-visible`, so waiting for a focusout is not enough.
		if (this.marked && this.marked !== focusOwnerOf(target)) this.unmark();
		// A finger landing on the element that already holds focus produces no
		// focusin, so the ring would stay visible on a button the keyboard (or
		// an earlier gesture) focused. A press is still pointer input: suppress.
		if (this.focused && pointerOwnsFocus(target, this.focused))
			this.mark(this.focused);
	}

	/** Keyboard input took over: no pending pointer focus ownership. */
	keyDown(): void {
		this.pointerTarget = null;
		// Keyboard takeover also revokes a ring already handed to a finger,
		// even when focus does not move: tapping a field and then typing on a
		// physical keyboard is keyboard use, and the focused element must show
		// its ring again. Waiting for a focusout/focusin pair missed exactly
		// that case, leaving the ring hidden for a real keyboard user.
		this.unmark();
	}

	/** The gesture was cancelled (scroll takeover): it focused nothing new. */
	pointerCancel(): void {
		this.pointerTarget = null;
	}

	/** Focus moved (or was set) on `focused`. */
	focusIn(focused: FocusRingElement | null): void {
		this.focused = focusOwnerOf(focused) ?? focused;
		if (pointerOwnsFocus(this.pointerTarget, focused)) {
			this.mark(focused);
			// Owned focus is spent: a later screen-reader/scripted focus of the
			// same element must get its ring back.
			this.pointerTarget = null;
			return;
		}
		this.unmark();
	}

	focusOut(blurred: FocusRingElement | null): void {
		if (blurred && this.focused === blurred) this.focused = null;
		if (blurred && this.marked === blurred) this.unmark();
	}

	isSuppressed(element: FocusRingElement | null): boolean {
		return !!element && this.marked === element;
	}

	private mark(element: FocusRingElement | null): void {
		if (!element) {
			this.unmark();
			return;
		}
		if (this.marked && this.marked !== element) this.clear(this.marked);
		this.marked = element;
		element.setAttribute(POINTER_FOCUS_ATTR, 'true');
	}

	private unmark(): void {
		if (!this.marked) return;
		this.clear(this.marked);
		this.marked = null;
	}

	private clear(element: FocusRingElement): void {
		element.removeAttribute(POINTER_FOCUS_ATTR);
	}
}

const elementOf = (node: EventTarget | null): FocusRingElement | null =>
	node instanceof Element ? (node as unknown as FocusRingElement) : null;

/** Wires the state to the live document. Call once at start-up. */
export function installPointerFocusRing(
	state: FocusRingState = new FocusRingState(),
	root: Document = document,
): FocusRingState {
	root.addEventListener(
		'pointerdown',
		(event) => state.pointerDown(elementOf(event.target)),
		true,
	);
	root.addEventListener('pointercancel', () => state.pointerCancel(), true);
	root.addEventListener('keydown', () => state.keyDown(), true);
	root.addEventListener(
		'focusin',
		(event) => state.focusIn(elementOf(event.target)),
		true,
	);
	root.addEventListener(
		'focusout',
		(event) => state.focusOut(elementOf(event.target)),
		true,
	);
	return state;
}

if (typeof document !== 'undefined') installPointerFocusRing();
