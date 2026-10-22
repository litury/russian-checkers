import { requiredElement } from '@/client/platform/browser/dom';

const root = requiredElement('opening');
const dialog = requiredElement<HTMLDialogElement>('opening-modes-dialog');
const start = requiredElement<HTMLButtonElement>('opening-start');
const back = requiredElement<HTMLButtonElement>('opening-modes-back');
const skill = requiredElement<HTMLSelectElement>('opening-bot-skill');
let returning = false;

function available() {
	return (
		!root.hidden &&
		!root.inert &&
		!window.checkersStartup.playCommitted &&
		!window.checkersStartup.pendingPlay &&
		!window.checkersStartup.pendingOnline
	);
}

function render(modes: boolean) {
	if (!modes) {
		if (dialog.open) dialog.close();
		root.dispatchEvent(new Event('opening-navigation-back'));
		if (!root.hidden && !root.inert && !document.querySelector('dialog[open]'))
			start.focus({ preventScroll: true });
		return;
	}
	if (!available() || !requiredElement('opening-search').hidden) return;
	skill.value = window.checkersSettings.get().botSkill;
	if (!dialog.open) dialog.showModal();
	requiredElement('opening-modes-title').focus({ preventScroll: true });
}

function closeModes() {
	if (returning) return;
	root.dataset.menuPage = 'main';
	if (history.state?.menuPage === 'modes') {
		returning = true;
		history.back();
	}
	render(false);
}

start.addEventListener('click', () => {
	if (!available() || returning) return;
	if (history.state?.menuPage !== 'modes')
		history.pushState({ ...history.state, menuPage: 'modes' }, '');
	root.dataset.menuPage = 'modes';
	render(true);
});
back.addEventListener('click', closeModes);
dialog.addEventListener('cancel', (event) => {
	event.preventDefault();
	if (available()) closeModes();
});

skill.addEventListener('change', () => {
	const value = skill.value;
	if (value === 'easy' || value === 'normal' || value === 'hard')
		window.checkersSettings.set({ botSkill: value });
});
window.addEventListener('checkers-settings-change', () => {
	skill.value = window.checkersSettings.get().botSkill;
});

window.addEventListener('popstate', () => {
	returning = false;
	const modes = history.state?.menuPage === 'modes';
	root.dataset.menuPage = modes ? 'modes' : 'main';
	if (
		!modes ||
		(!history.state?.onlineHub &&
			!history.state?.mh &&
			!history.state?.menuDialog)
	)
		render(modes);
});
root.addEventListener('opening-main-menu', closeModes);
root.addEventListener('opening-search-idle', () => {
	if (root.dataset.menuPage === 'modes') render(true);
});
window.addEventListener('keydown', (event) => {
	if (
		event.defaultPrevented ||
		event.key !== 'Escape' ||
		!available() ||
		document.querySelector('dialog[open]')
	)
		return;
	if (root.dataset.menuPage !== 'modes') return;
	event.preventDefault();
	closeModes();
});
root.dataset.menuPage = history.state?.menuPage === 'modes' ? 'modes' : 'main';
if (root.dataset.menuPage === 'modes') render(true);
