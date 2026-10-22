export type SearchPhase =
	| 'idle'
	| 'searching'
	| 'waiting'
	| 'found'
	| 'offline'
	| 'timeout-offer'
	| 'friend-wait'
	| 'friend-enter'
	| 'friend-miss'
	| 'friend-invalid'
	| 'friend-joining'
	| 'human-menu';

export const SEARCH_TIMEOUT_MS = 45_000;
export const FOUND_HOLD_MS = 800;

export type SearchView = {
	title: string;
	showCancel: boolean;
	showBot: boolean;
	hidePlay: boolean;
};

export function searchCopy(phase: SearchPhase): SearchView {
	const active = {
		showCancel: true,
		showBot: false,
		hidePlay: true,
	};
	if (phase === 'searching' || phase === 'waiting')
		return { ...active, title: 'Ищем соперника…' };
	if (phase === 'found')
		return { ...active, title: 'Соперник найден', showCancel: false };
	if (phase === 'offline')
		return { ...active, title: 'Нет связи с сервером', hidePlay: false };
	if (phase === 'timeout-offer')
		return {
			...active,
			title: 'Соперник пока не найден',
			showBot: true,
		};
	if (phase === 'friend-wait') return { ...active, title: 'Ждём друга' };
	if (phase === 'human-menu') return { ...active, title: 'С человеком' };
	if (phase === 'friend-enter') return { ...active, title: 'Введите код' };
	if (phase === 'friend-miss')
		return { ...active, title: 'Приглашение не найдено' };
	if (phase === 'friend-invalid') return { ...active, title: 'Введите 6 цифр' };
	if (phase === 'friend-joining') return { ...active, title: 'Подключаемся…' };
	return {
		title: '',
		showCancel: false,
		showBot: false,
		hidePlay: false,
	};
}
