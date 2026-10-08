/** Native modal makes the canvas and all other controls inert while deciding. */
export function bindResignConfirmation(
	trigger: HTMLButtonElement,
	confirm: () => void,
	available: () => boolean,
	art?: { ready: () => boolean; prepare: () => Promise<boolean>; feedback?: () => Promise<boolean>; statesReady?: () => boolean },
) {
	const dialog = document.getElementById('resign-confirmation') as HTMLDialogElement | null;
	const resume = document.getElementById('resign-continue') as HTMLButtonElement | null;
	const accept = document.getElementById('resign-confirm') as HTMLButtonElement | null;
	if (!dialog || !resume || !accept) return;
	const status = document.createElement('span');
	status.id = 'resign-art-status';
	status.setAttribute('role', 'status');
	status.setAttribute('aria-live', 'polite');
	trigger.parentElement?.appendChild(status);
	if (art && !art.ready()) trigger.setAttribute('data-art-cold', 'true');
	let generation = 0;
	let destroyed = false;
	void art?.feedback?.().then(ready => {
		if (ready && !destroyed) trigger.setAttribute('data-rest-ready', 'true');
	}).catch(() => {});
	let waiting = false;
	const reset = () => { waiting = false; trigger.removeAttribute('data-art-wait'); trigger.removeAttribute('aria-busy'); };
	const dismiss = () => { generation++; reset(); status.textContent = ''; if (dialog.open) dialog.close(); };
	const reveal = () => {
		if (trigger.disabled || !available() || dialog.open) return;
		dialog.showModal();
		resume.focus({ preventScroll: true });
	};
	const refreshStates = () => { if (!art?.statesReady || art.statesReady()) trigger.removeAttribute('data-art-cold'); };
	const open = () => {
		refreshStates();
		if (trigger.disabled || !available() || dialog.open || waiting) return;
		if (!art || art.ready()) { status.textContent = ''; refreshStates(); reveal(); return; }
		waiting = true;
		status.textContent = 'Подготавливаем окно сдачи…';
		trigger.setAttribute('data-art-wait', 'true'); trigger.setAttribute('aria-busy', 'true');
		const token = ++generation;
		// Bound transient feedback, then explain retry. Never surprise with a late modal.
		let expired = false;
		const timer = setTimeout(() => {
			if (token !== generation) return;
			expired = true;
			reset();
			status.textContent = 'Окно сдачи ещё загружается. Нажмите «Сдаться» ещё раз после загрузки.';
		}, 500);
		void art.prepare().catch(() => false).then(ready => {
			clearTimeout(timer);
			if (token !== generation) return;
			reset();
			if (!ready) {
				status.textContent = 'Не удалось загрузить окно сдачи. Нажмите «Сдаться», чтобы повторить.';
				return;
			}
			refreshStates();
			if (!expired) { status.textContent = ''; reveal(); }
			else if (!trigger.disabled && available()) status.textContent = 'Окно сдачи готово. Нажмите «Сдаться» ещё раз.';
			else status.textContent = '';
		});
	};
	const commit = () => {
		if (!dialog.open) return;
		dismiss();
		if (available()) confirm();
	};
	const restore = () => {
		if (!trigger.disabled && !trigger.hidden) trigger.focus({ preventScroll: true });
	};
	const keydown = (event: KeyboardEvent) => {
		if (event.key !== 'Tab') return;
		// An explicit two-control cycle also avoids the browser chrome tab stop.
		event.preventDefault();
		(document.activeElement === resume ? accept : resume).focus();
	};
	for (const event of ['pointerenter', 'pointerdown', 'focus']) trigger.addEventListener(event, refreshStates);
	trigger.addEventListener('click', open);
	resume.addEventListener('click', dismiss);
	accept.addEventListener('click', commit);
	dialog.addEventListener('close', restore);
	dialog.addEventListener('keydown', keydown);
	return {
		dismiss,
		destroy() {
			destroyed = true;
			for (const event of ['pointerenter', 'pointerdown', 'focus']) trigger.removeEventListener(event, refreshStates);
			dismiss();
			status.remove();
			trigger.removeAttribute('data-rest-ready');
			trigger.removeAttribute('data-art-cold');
			trigger.removeEventListener('click', open);
			resume.removeEventListener('click', dismiss);
			accept.removeEventListener('click', commit);
			dialog.removeEventListener('close', restore);
			dialog.removeEventListener('keydown', keydown);
		},
	};
}
