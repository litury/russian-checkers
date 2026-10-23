import { requiredElement } from '@/client/platform/browser/dom';
import type { Side } from '@/shared/rules';

export interface DrawActionView {
	active: boolean;
	canOffer: boolean;
	humanSide: Side;
	offer: Side | null;
}

export function bindDrawConfirmation(handlers: {
	offer(): void;
	accept(): void;
	decline(): void;
}) {
	const trigger = requiredElement<HTMLButtonElement>('match-draw');
	const label = trigger.querySelector('.action-label');
	if (!label) throw new Error('Missing draw action label');
	const dialog = requiredElement<HTMLDialogElement>('draw-confirmation');
	const heading = requiredElement('draw-title');
	const copy = requiredElement('draw-copy');
	const accept = requiredElement<HTMLButtonElement>('draw-confirm');
	const resume = requiredElement<HTMLButtonElement>('draw-continue');
	const controls = new AbortController();
	const options = { signal: controls.signal };
	let latest: DrawActionView | undefined;
	let committed = false;
	const incoming = () =>
		Boolean(latest?.offer && latest.offer !== latest.humanSide);
	const dismiss = () => {
		if (dialog.open) dialog.close();
		committed = false;
	};
	trigger.addEventListener(
		'click',
		() => {
			if (!latest?.active || trigger.disabled || dialog.open) return;
			committed = false;
			const received = incoming();
			heading.textContent = received
				? 'Соперник предлагает ничью'
				: 'Предложить ничью?';
			copy.textContent = received
				? 'Принять или продолжить партию.'
				: 'Партия завершится, если соперник согласится.';
			accept.textContent = received ? 'Принять ничью' : 'Предложить ничью';
			accept.disabled = false;
			dialog.showModal();
			resume.focus();
		},
		options,
	);
	accept.addEventListener(
		'click',
		() => {
			if (!latest?.active || committed) return;
			if (!incoming() && !latest.canOffer) return dismiss();
			committed = true;
			if (incoming()) handlers.accept();
			else handlers.offer();
			dismiss();
		},
		options,
	);
	resume.addEventListener(
		'click',
		() => {
			if (incoming()) handlers.decline();
			dismiss();
		},
		options,
	);
	dialog.addEventListener(
		'cancel',
		() => {
			committed = false;
		},
		options,
	);
	return {
		paint(view: DrawActionView) {
			const changed = latest?.offer !== view.offer;
			latest = view;
			trigger.hidden = !view.active;
			trigger.disabled = !view.active || (!incoming() && !view.canOffer);
			label.textContent = incoming()
				? 'Ответить'
				: view.offer
					? 'Ждём'
					: 'Ничья';
			trigger.title = incoming()
				? 'Соперник предлагает ничью'
				: view.offer
					? 'Ожидаем ответа соперника'
					: view.canOffer
						? 'Предложить ничью'
						: 'Предложение доступно после вашего хода; повторное — после предложения соперника';
			trigger.setAttribute('aria-label', trigger.title);
			if (!view.active || changed) dismiss();
		},
		dismiss,
		dispose() {
			controls.abort();
			dismiss();
		},
	};
}
