/** Native modal makes the canvas and all other controls inert while deciding. */
export function bindResignConfirmation(
	trigger: HTMLButtonElement,
	confirm: () => void,
	available: () => boolean,
	art?: { ready: () => boolean; prepare: () => Promise<boolean> },
) {
	const dialog = document.getElementById('resign-confirmation') as HTMLDialogElement | null;
	const resume = document.getElementById('resign-continue') as HTMLButtonElement | null;
	const accept = document.getElementById('resign-confirm') as HTMLButtonElement | null;
	if (!dialog || !resume || !accept) return;
	let generation = 0;
	let waiting = false;
	const reset = () => { waiting = false; trigger.removeAttribute('data-art-wait'); trigger.removeAttribute('aria-busy'); };
	const dismiss = () => { generation++; reset(); if (dialog.open) dialog.close(); };
	const reveal = () => {
		if (trigger.disabled || !available() || dialog.open) return;
		dialog.showModal();
		resume.focus({ preventScroll: true });
	};
	const open = () => {
		if (trigger.disabled || !available() || dialog.open || waiting) return;
		if (!art || art.ready()) { reveal(); return; }
		waiting = true;
		trigger.setAttribute('data-art-wait', 'true'); trigger.setAttribute('aria-busy', 'true');
		const token = ++generation;
		// 500 ms caps a transient pressed state; cold large PNGs may require another click.
		let timer: ReturnType<typeof setTimeout>;
		const timeout = new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 500); });
		void Promise.race([art.prepare().catch(() => false), timeout]).then(ready => {
			clearTimeout(timer);
			if (token !== generation) return;
			reset();
			if (ready) reveal();
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
	trigger.addEventListener('click', open);
	resume.addEventListener('click', dismiss);
	accept.addEventListener('click', commit);
	dialog.addEventListener('close', restore);
	dialog.addEventListener('keydown', keydown);
	return {
		dismiss,
		destroy() {
			dismiss();
			trigger.removeEventListener('click', open);
			resume.removeEventListener('click', dismiss);
			accept.removeEventListener('click', commit);
			dialog.removeEventListener('close', restore);
			dialog.removeEventListener('keydown', keydown);
		},
	};
}
