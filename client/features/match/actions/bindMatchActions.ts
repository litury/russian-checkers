import { uiSfx } from '@/client/audio/uiSfx';
import { canUndoBot } from '../botUndo';
import type { MatchPhase } from '../matchSession';

interface ActionView {
	phase: MatchPhase;
	online: boolean;
	paused: boolean;
	flagLock: boolean;
	undoDepth: number;
	concealed: boolean;
	entered: boolean;
}

import {
	prepareResignArt,
	prepareResignFeedback,
	resignArtReady,
	resignStatesReady,
} from './matchActionArtWarmup';
import { bindResignConfirmation } from './resignConfirmation';
export function bindMatchActions(handlers: {
	undo(): void;
	resign(): void;
	available(): boolean;
}) {
	const undo = document.getElementById('match-undo');
	const onUndo = () => handlers.undo();
	undo?.addEventListener('click', onUndo);
	const trigger = document.getElementById(
		'match-resign',
	) as HTMLButtonElement | null;
	const confirmation = trigger
		? bindResignConfirmation(trigger, handlers.resign, handlers.available, {
				ready: resignArtReady,
				prepare: prepareResignArt,
				feedback: prepareResignFeedback,
				statesReady: resignStatesReady,
			})
		: undefined;
	const paint = (view: ActionView): boolean => {
		let entered = view.entered;

		// The perf seam and other headless specs run without a DOM: the rail is a
		// browser-only surface, so there is nothing to paint there.
		if (typeof document === 'undefined') return entered;
		const rail = document.getElementById('match-actions');
		const undo = document.getElementById(
			'match-undo',
		) as HTMLButtonElement | null;
		const resign = document.getElementById(
			'match-resign',
		) as HTMLButtonElement | null;
		const inMatch = view.phase !== 'title';
		if (!inMatch || view.phase === 'over') confirmation?.dismiss();
		if (rail) {
			rail.hidden = !inMatch;
			// Lifecycle visibility only: the in-card overlay reserves no field space.
			const conceal = view.concealed;
			if (!conceal && inMatch && !entered) {
				entered = true;
				uiSfx('panel-ready');
			}
			if (rail.style) rail.style.visibility = conceal ? 'hidden' : '';
			rail.inert = conceal;
			rail.setAttribute('aria-hidden', conceal ? 'true' : 'false');
		}
		if (undo) {
			undo.hidden = !inMatch;
			undo.disabled =
				view.phase === 'over' ||
				view.phase === 'bot' ||
				view.concealed ||
				!canUndoBot(view.online, view.undoDepth);
			const reason = view.online
				? 'В сетевой партии отмена недоступна'
				: view.phase === 'bot'
					? 'Дождитесь ответа соперника'
					: 'Отмена появится после вашего хода и ответа соперника';
			undo.title = undo.disabled ? reason : 'Отменить ход';
			const explanation = document.getElementById('match-undo-reason');
			if (explanation)
				explanation.textContent = undo.disabled
					? reason
					: 'Отменяет ваш ход и ответ соперника';
			if (undo.parentElement) undo.parentElement.title = undo.title;
			if (undo.style) undo.style.visibility = view.concealed ? 'hidden' : '';
		}
		if (resign) {
			resign.hidden = !inMatch;
			resign.disabled =
				view.concealed || view.phase === 'over' || view.paused || view.flagLock;
			if (resign.style)
				resign.style.visibility = view.concealed ? 'hidden' : '';
		}

		return entered;
	};
	return {
		paint,
		dismiss: () => confirmation?.dismiss(),
		dispose() {
			undo?.removeEventListener('click', onUndo);
			confirmation?.destroy();
		},
	};
}
