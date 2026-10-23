import { uiSfx } from '@/client/audio/uiSfx';
import { requiredElement } from '@/client/platform/browser/dom';
import {
	canResign,
	type UndoState,
	undoBlockedReason,
} from './matchActionState';
import { bindResignConfirmation } from './resignConfirmation';

interface ActionView extends UndoState {
	concealed: boolean;
	entered: boolean;
}

export function bindMatchActions(handlers: {
	undo(): void;
	resign(): void;
	available(): boolean;
}) {
	const undo = requiredElement<HTMLButtonElement>('match-undo');
	const resign = requiredElement<HTMLButtonElement>('match-resign');
	const rail = requiredElement('match-actions');
	const explanation = requiredElement('match-undo-reason');
	const controls = new AbortController();
	const options = { signal: controls.signal };
	const confirmation = bindResignConfirmation(
		resign,
		handlers.resign,
		handlers.available,
	);
	let latest: ActionView | null = null;
	const hideExplanation = () => {
		explanation.hidden = true;
		undo.setAttribute('aria-expanded', 'false');
	};
	const showExplanation = () => {
		if (!latest || latest.concealed || rail.hidden) return;
		explanation.hidden = false;
		undo.setAttribute('aria-expanded', 'true');
	};
	undo.addEventListener(
		'click',
		() => {
			if (!latest || latest.concealed) return;
			if (undoBlockedReason(latest)) {
				undo.focus({ preventScroll: true });
				showExplanation();
				return;
			}
			hideExplanation();
			handlers.undo();
		},
		options,
	);
	undo.addEventListener('focus', showExplanation, options);
	undo.addEventListener('blur', hideExplanation, options);
	undo.addEventListener(
		'pointerenter',
		(event) => {
			if (event.pointerType === 'mouse') showExplanation();
		},
		options,
	);
	undo.addEventListener(
		'pointerleave',
		() => {
			if (document.activeElement !== undo) hideExplanation();
		},
		options,
	);
	document.addEventListener(
		'pointerdown',
		(event) => {
			if (event.target instanceof Node && !undo.contains(event.target))
				hideExplanation();
		},
		{ ...options, capture: true },
	);
	undo.addEventListener(
		'keydown',
		(event) => {
			if (event.key === 'Escape' && !explanation.hidden) {
				event.preventDefault();
				hideExplanation();
			}
		},
		options,
	);
	return {
		paint(view: ActionView): boolean {
			latest = view;
			rail.dataset.online = String(view.online);
			undo.hidden = view.online;
			if (view.online) hideExplanation();
			const inMatch = view.phase === 'human' || view.phase === 'bot';
			if (
				view.phase === 'title' ||
				(view.phase !== 'over' && (view.paused || view.flagLock))
			)
				confirmation.dismiss();
			rail.hidden = !inMatch;
			rail.style.visibility = view.concealed ? 'hidden' : '';
			rail.inert = view.concealed;
			rail.setAttribute('aria-hidden', String(view.concealed));
			if (view.concealed || !inMatch) hideExplanation();
			const reason = undoBlockedReason(view);
			undo.setAttribute(
				'aria-disabled',
				String(view.concealed || reason !== null),
			);
			const description =
				reason ?? 'Возвращает ваш ход, ответ компьютера и время на часах.';
			if (explanation.textContent !== description)
				explanation.textContent = description;
			resign.disabled = view.concealed || !canResign(view);
			if (!view.concealed && inMatch && !view.entered) {
				uiSfx('panel-ready');
				return true;
			}
			return view.entered;
		},
		dismiss: () => confirmation.dismiss(),
		dispose() {
			controls.abort();
			hideExplanation();
			confirmation.destroy();
		},
	};
}
