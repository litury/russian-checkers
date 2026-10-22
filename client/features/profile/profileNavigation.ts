import { requiredElement } from '@/client/platform/browser/dom';
import { isMatchRow, type MatchRow } from '@/shared/protocol/matchHistory';

export type ProfilePage =
	| 'root'
	| 'account'
	| 'list'
	| 'record'
	| 'settings'
	| 'rules';
const pages: ProfilePage[] = [
	'root',
	'account',
	'list',
	'record',
	'settings',
	'rules',
];

export function bindProfileNavigation(handlers: {
	show: (
		page: ProfilePage,
		record: MatchRow | null,
		returning: boolean,
	) => void;
	close: () => void;
}) {
	const dialog = requiredElement<HTMLDialogElement>('match-history');
	const opening = requiredElement('opening');
	const back = requiredElement<HTMLButtonElement>('match-history-back');
	let changing = false;
	let returning = false;
	const owned = () => history.state?.profileMenu === true;
	const display = (
		page: ProfilePage,
		record: MatchRow | null,
		fromHistory: boolean,
	) => {
		if (opening.hidden) return;
		opening.inert = true;
		if (!dialog.open) dialog.showModal();
		dialog.dataset.profilePage = page;
		back.textContent = page === 'root' ? '← В меню' : '← Назад';
		back.setAttribute(
			'aria-label',
			page === 'root'
				? 'В главное меню'
				: page === 'record'
					? 'К списку партий'
					: 'В профиль',
		);
		handlers.show(page, record, fromHistory);
	};
	const close = () => {
		if (!dialog.open) return;
		changing = true;
		dialog.close();
		opening.inert = false;
		handlers.close();
	};
	const sync = () => {
		returning = false;
		if (!owned()) {
			close();
			return;
		}
		const saved = history.state;
		const page = pages.includes(saved.profilePage)
			? (saved.profilePage as ProfilePage)
			: 'root';
		const record = isMatchRow(saved.profileRecord) ? saved.profileRecord : null;
		display(page === 'record' && !record ? 'list' : page, record, true);
	};
	const open = (page: ProfilePage = 'root', record: MatchRow | null = null) => {
		if (opening.hidden || returning || (!dialog.open && opening.inert)) return;
		if (dialog.open && dialog.dataset.profilePage === page && page !== 'record')
			return;
		if (!dialog.open && page !== 'root') {
			history.pushState(
				{ ...history.state, profileMenu: true, profilePage: 'root' },
				'',
			);
		}
		history.pushState(
			{
				...history.state,
				profileMenu: true,
				profilePage: page,
				profileRecord: record,
			},
			'',
		);
		display(page, record, false);
	};
	const goBack = () => {
		if (returning) return;
		returning = true;
		if (owned()) history.back();
		else {
			close();
			returning = false;
		}
	};
	back.addEventListener('click', goBack);
	dialog.addEventListener('cancel', (event) => {
		event.preventDefault();
		goBack();
	});
	dialog.addEventListener('close', () => {
		if (changing) {
			changing = false;
		} else {
			opening.inert = false;
			handlers.close();
			if (owned()) history.back();
		}
	});
	window.addEventListener('popstate', sync);
	return { open, restore: sync };
}
