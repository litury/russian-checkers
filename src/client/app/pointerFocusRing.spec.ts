import { describe, expect, it, vi } from 'vitest';
import {
	FOCUS_HOOK,
	FOCUSABLE_SELECTOR,
	FocusRingState,
	installExplicitFocusHook,
	POINTER_FOCUS_ATTR,
	pointerOwnsFocus,
} from './pointerFocusRing';

/**
 * Minimal element stub: only the relationships the tracker relies on
 * (ancestry, containment, the marker attribute). No DOM library is installed,
 * and the decision under test is deliberately DOM-free.
 */
class FakeElement {
	readonly tagName: string;

	readonly attrs = new Map<string, string>();

	parent: FakeElement | null = null;

	children: FakeElement[] = [];

	constructor(tagName: string, attrs: Record<string, string> = {}) {
		this.tagName = tagName.toUpperCase();
		for (const [name, value] of Object.entries(attrs))
			this.attrs.set(name, value);
	}

	append(child: FakeElement): FakeElement {
		child.parent = this;
		this.children.push(child);
		return child;
	}

	closest(selector: string): FakeElement | null {
		let node: FakeElement | null = this;
		while (node) {
			if (node.matches(selector)) return node;
			node = node.parent;
		}
		return null;
	}

	contains(other: FakeElement): boolean {
		let node: FakeElement | null = other;
		while (node) {
			if (node === this) return true;
			node = node.parent;
		}
		return false;
	}

	setAttribute(name: string, value: string): void {
		this.attrs.set(name, value);
	}

	removeAttribute(name: string): void {
		this.attrs.delete(name);
	}

	hasAttribute(name: string): boolean {
		return this.attrs.has(name);
	}

	private matches(selector: string): boolean {
		if (selector === 'label') return this.tagName === 'LABEL';
		if (selector !== FOCUSABLE_SELECTOR)
			throw new Error(`unexpected selector: ${selector}`);
		if (
			['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'].includes(
				this.tagName,
			)
		)
			return true;
		if (this.tagName === 'A' && this.attrs.has('href')) return true;
		const tabindex = this.attrs.get('tabindex');
		return tabindex !== undefined && tabindex !== '-1';
	}
}

const scene = () => {
	const html = new FakeElement('html');
	const body = html.append(new FakeElement('body'));
	const dialog = body.append(new FakeElement('dialog'));
	// A result/menu window button, and a control from the settings dialog.
	const menuButton = dialog.append(
		new FakeElement('button', { 'data-result': 'menu' }),
	);
	const label = dialog.append(new FakeElement('label'));
	const email = label.append(
		new FakeElement('input', { id: 'settings-email' }),
	);
	const backdrop = body.append(new FakeElement('div', { id: 'backdrop' }));
	const canvas = body.append(new FakeElement('canvas', { tabindex: '0' }));
	const other = dialog.append(new FakeElement('button', { id: 'other' }));
	return {
		html,
		body,
		dialog,
		menuButton,
		label,
		email,
		backdrop,
		canvas,
		other,
	};
};

describe('pointerOwnsFocus', () => {
	it('owns the focusable it pressed, its children and the control of a pressed label', () => {
		const s = scene();
		const span = s.menuButton.append(new FakeElement('span'));
		expect(pointerOwnsFocus(s.menuButton, s.menuButton)).toBe(true);
		expect(pointerOwnsFocus(span, s.menuButton)).toBe(true);
		expect(pointerOwnsFocus(s.label, s.email)).toBe(true);
		expect(pointerOwnsFocus(s.canvas, s.canvas)).toBe(true);
	});

	it('does not claim a button focused later over the page background', () => {
		const s = scene();
		// The whole page contains every button; that must not turn a later
		// scripted focus into pointer focus.
		expect(pointerOwnsFocus(s.body, s.menuButton)).toBe(false);
		expect(pointerOwnsFocus(s.backdrop, s.menuButton)).toBe(false);
		expect(pointerOwnsFocus(s.dialog, s.menuButton)).toBe(false);
		expect(pointerOwnsFocus(null, s.menuButton)).toBe(false);
	});
});

describe('touch focus ring regression', () => {
	it('suppresses the ring for the tapped element only', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.menuButton);
		state.focusIn(s.menuButton);

		expect(state.isSuppressed(s.menuButton)).toBe(true);
		expect(s.menuButton.hasAttribute(POINTER_FOCUS_ATTR)).toBe(true);
		expect(state.isSuppressed(s.email)).toBe(false);
		expect(s.email.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);
	});

	it('keeps the ring for a keyboard focus even after a tap', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.menuButton);
		state.focusIn(s.menuButton);
		// Tab: keydown first, then the focus move.
		state.keyDown();
		state.focusOut(s.menuButton);
		state.focusIn(s.email);

		expect(state.isSuppressed(s.email)).toBe(false);
		expect(s.email.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);
		expect(s.menuButton.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);
	});

	it('gives the ring back to a scripted/screen-reader focus after a tap', () => {
		const s = scene();
		const state = new FocusRingState();

		// 1. tap the result background (nothing focusable is pressed),
		state.pointerDown(s.backdrop);
		// 2. the tap clears the previous ring,
		state.pointerDown(s.menuButton);
		state.focusIn(s.menuButton);
		expect(state.isSuppressed(s.menuButton)).toBe(true);
		// 3. touch the empty background again,
		state.pointerDown(s.backdrop);
		expect(state.isSuppressed(s.menuButton)).toBe(false);
		// 4. assistive technology / script focus with focusVisible.
		state.focusIn(s.menuButton);
		expect(state.isSuppressed(s.menuButton)).toBe(false);
		expect(s.menuButton.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);
	});

	it('gives the ring back when the same element is focused again later', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.menuButton);
		state.focusIn(s.menuButton);
		state.focusOut(s.menuButton);
		state.focusIn(s.menuButton);

		expect(state.isSuppressed(s.menuButton)).toBe(false);
		expect(s.menuButton.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);
	});

	it('keeps the ring suppressed while the tapped element stays focused', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.menuButton);
		state.focusIn(s.menuButton);
		// An engine that keeps :focus-visible matched after a touch: the marker
		// has to survive the pointerup, so no event may clear it here.
		expect(state.isSuppressed(s.menuButton)).toBe(true);
		state.pointerDown(s.menuButton);
		expect(state.isSuppressed(s.menuButton)).toBe(true);
	});

	it('marks focus forwarded by a pressed label and clears it on a later script focus', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.label);
		state.focusIn(s.email);
		expect(state.isSuppressed(s.email)).toBe(true);
		expect(s.email.hasAttribute(POINTER_FOCUS_ATTR)).toBe(true);

		state.pointerDown(s.backdrop);
		state.focusIn(s.email);
		expect(state.isSuppressed(s.email)).toBe(false);
	});

	it('does not suppress the ring on the board canvas after a keyboard focus', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.canvas);
		state.focusIn(s.canvas);
		expect(state.isSuppressed(s.canvas)).toBe(true);

		state.keyDown();
		state.focusOut(s.canvas);
		state.focusIn(s.canvas);
		expect(state.isSuppressed(s.canvas)).toBe(false);
	});

	it('clears the pointer suppression on keyboard input without any focus move', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.menuButton);
		state.focusIn(s.menuButton);
		expect(state.isSuppressed(s.menuButton)).toBe(true);

		// Keyboard takeover while the tapped element keeps focus (no Tab, no
		// focusout): the ring has to come back on that very element.
		state.keyDown();

		expect(state.isSuppressed(s.menuButton)).toBe(false);
		expect(s.menuButton.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);
	});

	it('restores the ring when typing starts in a field a tap focused', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.label);
		state.focusIn(s.email);
		expect(state.isSuppressed(s.email)).toBe(true);

		// Physical keyboard input in the still-focused field.
		state.keyDown();
		expect(state.isSuppressed(s.email)).toBe(false);
		expect(s.email.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);

		// A later tap on that same field suppresses the ring again.
		state.pointerDown(s.label);
		state.focusIn(s.email);
		expect(state.isSuppressed(s.email)).toBe(true);
	});

	it('keeps the suppression when the gesture is cancelled without keyboard input', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.menuButton);
		state.focusIn(s.menuButton);
		// pointercancel only drops the pending gesture; the ring stays hidden
		// for the element the finger focused until real keyboard input.
		state.pointerCancel();
		expect(state.isSuppressed(s.menuButton)).toBe(true);

		state.pointerDown(s.backdrop);
		expect(state.isSuppressed(s.menuButton)).toBe(false);
	});

	it('suppresses the ring again when the finger returns to a keyboard-focused button', () => {
		const s = scene();
		const state = new FocusRingState();

		// Tab focused the button: the ring shows.
		state.focusIn(s.menuButton);
		expect(state.isSuppressed(s.menuButton)).toBe(false);

		// The finger lands on that already-focused button: no focusin fires, so
		// the press itself has to hide the ring.
		state.pointerDown(s.menuButton);
		expect(state.isSuppressed(s.menuButton)).toBe(true);
		expect(s.menuButton.hasAttribute(POINTER_FOCUS_ATTR)).toBe(true);

		// Keyboard again: the ring is back without moving focus.
		state.keyDown();
		expect(state.isSuppressed(s.menuButton)).toBe(false);
	});

	it('moves the mark instead of accumulating it', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.menuButton);
		state.focusIn(s.menuButton);
		state.pointerDown(s.email);
		state.focusIn(s.email);

		expect(state.isSuppressed(s.email)).toBe(true);
		expect(state.isSuppressed(s.menuButton)).toBe(false);
		expect(s.menuButton.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);
	});
});

describe('explicit non-pointer focus request', () => {
	/**
	 * The regression a finger-then-keyboard-then-finger sequence reaches:
	 * the second press marks the button that still holds focus, so the press
	 * fires no focusin, and `focus({focusVisible:true})` on the active element
	 * fires none either. Nothing observable happens between the mark and the
	 * request, so only the request itself can lift it.
	 */
	it('lifts the mark when a visible focus is requested on the marked element', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.menuButton); // tap
		state.focusIn(s.menuButton);
		state.keyDown(); // physical key, focus does not move
		state.pointerDown(s.menuButton); // finger returns to that button
		expect(state.isSuppressed(s.menuButton)).toBe(true);

		state.explicitVisibleFocus(s.menuButton);

		expect(state.isSuppressed(s.menuButton)).toBe(false);
		expect(s.menuButton.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);
	});

	it('keeps the mark when the request targets some other element', () => {
		const s = scene();
		const state = new FocusRingState();

		state.pointerDown(s.menuButton);
		state.focusIn(s.menuButton);

		state.explicitVisibleFocus(s.email);

		expect(state.isSuppressed(s.menuButton)).toBe(true);
		expect(s.menuButton.hasAttribute(POINTER_FOCUS_ATTR)).toBe(true);
	});
});

describe('installExplicitFocusHook', () => {
	type FocusProto = { focus(this: unknown, options?: FocusOptions): void };

	const viewOf = (proto: FocusProto) =>
		({ HTMLElement: { prototype: proto } }) as unknown as Window;

	it('releases the mark through focus({focusVisible:true}) and leaves it otherwise', () => {
		const s = scene();
		const state = new FocusRingState();
		const original = vi.fn<(this: unknown, options?: FocusOptions) => void>();
		const proto: FocusProto = { focus: original };
		installExplicitFocusHook(state, viewOf(proto));

		state.pointerDown(s.menuButton);
		state.focusIn(s.menuButton);
		expect(state.isSuppressed(s.menuButton)).toBe(true);

		proto.focus.call(s.menuButton, { focusVisible: true });

		expect(original).toHaveBeenCalledTimes(1);
		expect(state.isSuppressed(s.menuButton)).toBe(false);
		expect(s.menuButton.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);

		// A press marks again; a plain or explicitly hidden focus request is
		// pointer-compatible and must not bring the ring back under the finger.
		state.pointerDown(s.menuButton);
		expect(state.isSuppressed(s.menuButton)).toBe(true);

		proto.focus.call(s.menuButton, undefined);
		proto.focus.call(s.menuButton, { focusVisible: false });

		expect(state.isSuppressed(s.menuButton)).toBe(true);
	});

	it('wraps focus() once, however often the module is installed', () => {
		const proto: FocusProto = { focus: vi.fn() };
		installExplicitFocusHook(new FocusRingState(), viewOf(proto));
		const wrapped = proto.focus;

		installExplicitFocusHook(new FocusRingState(), viewOf(proto));

		expect(proto.focus).toBe(wrapped);
		expect((proto as Record<PropertyKey, unknown>)[FOCUS_HOOK]).toBe(true);
	});
});
