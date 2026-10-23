import { requiredElement } from '@/client/platform/browser/dom';
import { uiSfx } from '../../../audio/uiSfx';

export function bindResignConfirmation(
	trigger: HTMLButtonElement,
	confirm: () => void,
	available: () => boolean,
) {
	const dialog = requiredElement<HTMLDialogElement>('resign-confirmation');
	const resume = requiredElement<HTMLButtonElement>('resign-continue');
	const accept = requiredElement<HTMLButtonElement>('resign-confirm');
	const heading = requiredElement('resign-title');
	const status = requiredElement('resign-status');
	const resumeLabel = resume.querySelector('.action-label');
	const acceptLabel = accept.querySelector('.action-label');
	const controls = new AbortController();
	const options = { signal: controls.signal };
	let committed = false;
	let destroyed = false;
	let outcomeTimer: ReturnType<typeof setTimeout> | undefined;
	const reset = () => {
		clearTimeout(outcomeTimer);
		committed = false;
		resume.disabled = accept.disabled = false;
		accept.removeAttribute('aria-busy');
		dialog.removeAttribute('data-handoff');
		status.hidden = true;
		status.textContent = '';
		if (resumeLabel) resumeLabel.textContent = 'Продолжить игру';
		if (acceptLabel) acceptLabel.textContent = 'Сдаться';
	};
	const finishClose = () => {
		reset();
		if (dialog.open) dialog.close();
	};
	const dismiss = () => {
		if (committed || !dialog.open) return;
		finishClose();
	};
	const recover = () => {
		clearTimeout(outcomeTimer);
		if (destroyed || !committed || !dialog.open) return;
		if (document.querySelector('.board-verdict.expanded:not([hidden])')) return;
		committed = false;
		resume.disabled = false;
		accept.disabled = !available();
		accept.removeAttribute('aria-busy');
		dialog.removeAttribute('data-handoff');
		status.hidden = false;
		status.textContent =
			'Нет подтверждения сдачи. Можно повторить запрос. Отправленную сдачу отменить нельзя.';
		if (resumeLabel) resumeLabel.textContent = 'Вернуться к доске';
		if (acceptLabel) acceptLabel.textContent = 'Повторить сдачу';
		resume.focus({ preventScroll: true });
	};
	trigger.addEventListener(
		'click',
		() => {
			if (destroyed || trigger.disabled || !available() || dialog.open) return;
			reset();
			const content = dialog.querySelector<HTMLElement>('.resign-content');
			if (content) content.scrollTop = 0;
			dialog.showModal();
			resume.focus({ preventScroll: true });
			uiSfx('ui-open');
		},
		options,
	);
	resume.addEventListener(
		'click',
		() => {
			if (committed) return;
			uiSfx('ui-close');
			dismiss();
		},
		options,
	);
	accept.addEventListener(
		'click',
		() => {
			if (destroyed || !dialog.open || committed) return;
			if (!available()) {
				finishClose();
				return;
			}
			committed = true;
			resume.disabled = accept.disabled = true;
			accept.setAttribute('aria-busy', 'true');
			dialog.setAttribute('data-handoff', 'true');
			status.hidden = false;
			status.textContent = 'Ожидаем результат…';
			heading.focus({ preventScroll: true });
			outcomeTimer = setTimeout(recover, 5000);
			try {
				confirm();
			} catch {
				recover();
			}
		},
		options,
	);
	dialog.addEventListener(
		'cancel',
		(event) => {
			event.preventDefault();
			if (!committed) {
				uiSfx('ui-close');
				dismiss();
			}
		},
		options,
	);
	dialog.addEventListener(
		'close',
		() => {
			if (
				destroyed ||
				document.querySelector('.board-verdict.expanded:not([hidden])')
			)
				return;
			if (!trigger.disabled && !trigger.closest('[hidden], [inert]'))
				trigger.focus({ preventScroll: true });
		},
		options,
	);
	dialog.addEventListener(
		'keydown',
		(event) => {
			if (event.key !== 'Tab') return;
			event.preventDefault();
			const buttons = [resume, accept].filter((button) => !button.disabled);
			if (!buttons.length) {
				heading.focus({ preventScroll: true });
				return;
			}
			const index = buttons.indexOf(
				document.activeElement as HTMLButtonElement,
			);
			const next =
				index < 0
					? event.shiftKey
						? buttons.length - 1
						: 0
					: (index + (event.shiftKey ? -1 : 1) + buttons.length) %
						buttons.length;
			buttons[next].focus();
		},
		options,
	);
	document.addEventListener('damka:result-covered', finishClose, options);
	return {
		dismiss,
		destroy() {
			destroyed = true;
			controls.abort();
			finishClose();
		},
	};
}
