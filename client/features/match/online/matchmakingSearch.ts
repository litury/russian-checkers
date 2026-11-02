export type SearchPhase =
	| 'idle'
	| 'searching'
	| 'waiting'
	| 'found'
	| 'offline'
	| 'rate-limited'
	| 'update-required'
	| 'auth-failed'
	| 'browser-unsupported'
	| 'timeout-offer'
	| 'friend-wait'
	| 'friend-enter'
	| 'friend-miss'
	| 'friend-invalid'
	| 'friend-joining'
	| 'human-menu';

export const SEARCH_TIMEOUT_MS = 45_000;
export const FOUND_HOLD_MS = 800;

export type SearchFailure =
	| 'offline'
	| 'rate-limited'
	| 'update-required'
	| 'auth-failed'
	| 'browser-unsupported';

export function searchFailure(_error: string): SearchFailure {
	if (_error === 'update_required') return 'update-required';
	if (_error === 'unauthorized') return 'auth-failed';
	if (_error === 'rate') return 'rate-limited';
	if (_error === 'browser_unsupported') return 'browser-unsupported';
	return 'offline';
}

export function isSearchFailure(_phase: SearchPhase): boolean {
	return [
		'offline',
		'rate-limited',
		'update-required',
		'auth-failed',
		'browser-unsupported',
	].includes(_phase);
}

export function searchFailureDetail(_phase: SearchPhase): string {
	if (_phase === 'update-required')
		return 'Версия игры устарела. Обновите страницу — данные профиля сохранятся.';
	if (_phase === 'auth-failed')
		return 'Сервер не подтвердил профиль. Не очищайте данные сайта. Скопируйте диагностику для проверки.';
	if (_phase === 'browser-unsupported')
		return 'Обновите браузер или откройте игру в актуальном Chrome или Firefox.';
	if (_phase === 'rate-limited') return 'Подождите минуту и попробуйте снова.';
	if (_phase === 'offline')
		return 'Не удалось установить соединение. Проверьте сеть и попробуйте снова.';
	return '';
}

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
	if (phase === 'rate-limited')
		return { ...active, title: 'Слишком много попыток', hidePlay: false };
	if (phase === 'update-required')
		return { ...active, title: 'Нужно обновить игру', hidePlay: false };
	if (phase === 'auth-failed')
		return { ...active, title: 'Не удалось войти в профиль', hidePlay: false };
	if (phase === 'browser-unsupported')
		return { ...active, title: 'Браузер не поддерживается', hidePlay: false };
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
