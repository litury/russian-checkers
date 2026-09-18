export type SearchPhase = 'idle' | 'searching' | 'waiting' | 'found' | 'offline' | 'timeout-offer' | 'friend-wait';

export const SEARCH_TIMEOUT_MS = 45_000;
export const FOUND_HOLD_MS = 800;
export const CONNECT_BUDGET_MS = 1500;

export type SearchView = {
	title: string;
	showCancel: boolean;
	showStay: boolean;
	showBot: boolean;
	hidePlay: boolean;
};

export function searchCopy(phase: SearchPhase, seconds: number, join = ''): SearchView {
	if (phase === 'searching') {
		return {title: `Ищем соперника · ${seconds} с`, showCancel: true, showStay: false, showBot: false, hidePlay: true};
	}
	if (phase === 'waiting') {
		return {title: `Ждём второго игрока · ${seconds} с`, showCancel: true, showStay: false, showBot: false, hidePlay: true};
	}
	if (phase === 'found') {
		return {title: 'Соперник найден', showCancel: false, showStay: false, showBot: false, hidePlay: true};
	}
	if (phase === 'offline') {
		return {title: 'Нет связи с сервером', showCancel: false, showStay: false, showBot: false, hidePlay: false};
	}
	if (phase === 'timeout-offer') {
		return {title: 'Пока никого', showCancel: false, showStay: true, showBot: true, hidePlay: true};
	}
	if (phase === 'friend-wait') {
		return {title: join ? `Ждём друга · ${join}` : 'Ждём друга', showCancel: true, showStay: false, showBot: false, hidePlay: true};
	}
	return {title: '', showCancel: false, showStay: false, showBot: false, hidePlay: false};
}
