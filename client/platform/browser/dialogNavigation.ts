export function bindDialogNavigation(dialog: HTMLDialogElement) {
	const navigationKey = dialog.id;
	let returning = false;
	const ownsEntry = () => history.state?.menuDialog === navigationKey;
	const pop = () => {
		returning = false;
		if (ownsEntry()) {
			if (!dialog.open) dialog.showModal();
		} else if (dialog.open) dialog.close();
	};
	const close = () => {
		if (!ownsEntry() || returning) return;
		returning = true;
		history.back();
	};
	window.addEventListener('popstate', pop);
	dialog.addEventListener('close', close);
	return {
		open() {
			if (dialog.open || returning) return;
			history.pushState({ ...history.state, menuDialog: navigationKey }, '');
			dialog.showModal();
		},
		dispose() {
			window.removeEventListener('popstate', pop);
			dialog.removeEventListener('close', close);
		},
	};
}
