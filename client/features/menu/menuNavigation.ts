import { requiredElement } from '@/client/platform/browser/dom';
import './playMenu.css';
import { blitzStartMs } from '@/shared/rules';
import { uiSfx } from '../../audio/uiSfx';
import {
	type SearchPhase,
	searchCopy,
} from '../match/online/matchmakingSearch';
import { siegeSide } from './siegeSelection';

type Page = 'choose' | 'bot' | 'human' | 'friend' | 'enter' | 'room' | 'search';
const titles: Record<Page, string> = {
	choose: 'С кем играть?',
	bot: 'С компьютером',
	human: 'С человеком',
	friend: 'С другом',
	enter: 'Ввести код',
	room: 'Приглашение',
	search: 'Поиск соперника',
};
const root = requiredElement('opening');
const dialog = requiredElement<HTMLDialogElement>('opening-modes-dialog');
const start = requiredElement<HTMLButtonElement>('opening-start');
const back = requiredElement<HTMLButtonElement>('opening-modes-back');
const cancel = requiredElement<HTMLButtonElement>('opening-search-cancel');
const title = requiredElement('opening-modes-title');
const input = requiredElement<HTMLInputElement>('opening-friend-code');
const join = requiredElement<HTMLButtonElement>('opening-search-go');
const form = requiredElement<HTMLFormElement>('opening-friend-form');
const codeError = requiredElement('opening-friend-error');
const controls = new AbortController();
const options = { signal: controls.signal };
const key =
	typeof history.state?.playMenuKey === 'string'
		? history.state.playMenuKey
		: crypto.randomUUID();
let page: Page = 'choose';
let phase: SearchPhase = 'idle';
let returning = false;
let closing = false;
let invitation = '';
let lastAction: 'queue' | 'host' | 'join' = 'queue';
let onlineReady = false;

function canBack() {
	return (
		!root.hidden &&
		!root.inert &&
		!window.checkersStartup.pendingPlay &&
		!window.checkersStartup.playCommitted &&
		phase !== 'found'
	);
}

function owned() {
	return history.state?.playMenuKey === key;
}

function refreshBack() {
	back.disabled = !canBack();
	cancel.disabled = !canBack();
	for (const radio of dialog.querySelectorAll<HTMLInputElement>(
		'input[name="opening-bot-skill"]',
	))
		radio.disabled = back.disabled;
	for (const id of [
		'opening-search-find',
		'opening-search-create',
		'opening-search-enter',
		'opening-search-retry',
	])
		requiredElement<HTMLButtonElement>(id).disabled = !onlineReady;
	requiredElement('opening-online-loading').hidden =
		onlineReady || page === 'choose' || page === 'bot';
	validateCode();
}

function syncSkill() {
	const skill = window.checkersSettings.get().botSkill;
	for (const radio of dialog.querySelectorAll<HTMLInputElement>(
		'input[name="opening-bot-skill"]',
	))
		radio.checked = radio.value === skill;
	const color = siegeSide(root) === 'white' ? 'Белые' : 'Чёрные';
	requiredElement('opening-bot-rules').textContent =
		`${color} · ${clockLabel()} на игрока`;
}

function clockLabel() {
	const seconds = Math.ceil(blitzStartMs / 1000);
	return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function validateCode() {
	join.disabled = !onlineReady || !/^\d{6}$/.test(input.value);
}

function render(focus = true) {
	for (const section of dialog.querySelectorAll<HTMLElement>(
		'[data-play-page]',
	))
		section.hidden = section.dataset.playPage !== page;
	requiredElement('opening-presence').hidden = page !== 'human';
	const heading = page === 'search' ? searchCopy(phase).title : titles[page];
	if (title.textContent !== heading) title.textContent = heading;
	cancel.textContent =
		phase === 'friend-joining'
			? 'Отменить подключение'
			: phase === 'offline' && lastAction !== 'queue'
				? '← Назад'
				: 'Отменить поиск';
	back.hidden = page === 'search' && phase !== 'found';
	cancel.hidden = page !== 'search' || phase === 'found';
	back.textContent =
		phase === 'found'
			? 'Начинаем партию…'
			: page === 'room'
				? 'Отменить приглашение'
				: page === 'choose'
					? '← В меню'
					: '← Назад';
	syncSkill();
	validateCode();
	refreshBack();
	root.dataset.menuPage = 'modes';
	if (!dialog.open) dialog.showModal();
	if (focus) {
		dialog.scrollTop = 0;
		title.focus({ preventScroll: true });
	}
}

function navigate(next: Page, push = true) {
	if (root.hidden || root.inert || closing) return;
	const changed = page !== next || !dialog.open;
	if (!owned() || (push && changed)) {
		const depth = owned() ? Number(history.state.playDepth) + 1 : 1;
		history.pushState(
			{
				...history.state,
				menuPage: 'modes',
				playMenuKey: key,
				playPage: next,
				playDepth: depth,
			},
			'',
		);
	} else if (changed) {
		history.replaceState({ ...history.state, playPage: next }, '');
	}
	page = next;
	render(changed);
}

function cancelOnline() {
	if (window.checkersStartup.pendingOnline) {
		window.checkersStartup.pendingOnline = false;
		window.checkersStartup.onlineIntentAt = null;
		window.checkersStartup.idleOnline();
	}
	if (phase !== 'idle')
		root.dispatchEvent(new Event('opening-navigation-back'));
	phase = 'idle';
}

function goBack() {
	if (!canBack() || returning || closing) return;
	returning = true;
	cancelOnline();
	uiSfx('ui-close');
	if (owned()) history.back();
	else {
		returning = false;
		dialog.close();
		root.dataset.menuPage = 'main';
	}
}

function closeAll() {
	const depth = owned() ? Number(history.state.playDepth) : 0;
	if (dialog.open) dialog.close();
	page = 'choose';
	phase = 'idle';
	root.dataset.menuPage = 'main';
	if (depth > 0 && !closing) {
		closing = true;
		history.go(-depth);
	}
}

start.addEventListener(
	'click',
	() => {
		if (!canBack() || dialog.open || returning || closing) return;
		phase = 'idle';
		navigate('choose');
		uiSfx('ui-open');
	},
	options,
);
requiredElement('opening-computer').addEventListener(
	'click',
	() => {
		navigate('bot');
		uiSfx('ui-tap');
	},
	options,
);
requiredElement('opening-friend').addEventListener(
	'click',
	() => {
		navigate('friend');
		uiSfx('ui-tap');
	},
	options,
);
back.addEventListener('click', goBack, options);
cancel.addEventListener('click', goBack, options);
dialog.addEventListener(
	'cancel',
	(event) => {
		event.preventDefault();
		goBack();
	},
	options,
);
root.addEventListener('opening-main-menu', closeAll, options);

window.addEventListener(
	'popstate',
	() => {
		if (closing) {
			closing = false;
			returning = false;
			return;
		}
		if (root.hidden || root.inert) {
			dialog.close();
			return;
		}
		if (!canBack()) return;
		if (!returning && phase !== 'idle') cancelOnline();
		returning = false;
		if (owned()) {
			const next = String(history.state.playPage);
			page = next in titles ? (next as Page) : 'choose';
			if ((page === 'room' || page === 'search') && phase === 'idle') {
				page = 'human';
				history.replaceState({ ...history.state, playPage: page }, '');
			}
			render();
		} else {
			if (dialog.open) dialog.close();
			root.dataset.menuPage = 'main';
			if (!document.querySelector('dialog[open]'))
				start.focus({ preventScroll: true });
		}
	},
	options,
);

for (const radio of dialog.querySelectorAll<HTMLInputElement>(
	'input[name="opening-bot-skill"]',
))
	radio.addEventListener(
		'change',
		() => {
			if (!radio.checked) return;
			const skill = radio.value;
			if (skill === 'easy' || skill === 'normal' || skill === 'hard')
				window.checkersSettings.set({ botSkill: skill });
			uiSfx('ui-tap');
		},
		options,
	);
window.addEventListener('checkers-settings-change', syncSkill, options);
root.addEventListener('siege-side', syncSkill, options);
input.addEventListener(
	'paste',
	(event) => {
		let text = event.clipboardData?.getData('text') ?? '';
		try {
			text = new URL(text).searchParams.get('join') ?? text;
		} catch {}
		const digits = text.replace(/\D/g, '');
		if (!/^\d{6}$/.test(digits)) return;
		event.preventDefault();
		input.value = digits;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	},
	options,
);
input.addEventListener(
	'input',
	() => {
		input.value = input.value.replace(/\D/g, '').slice(0, 6);
		codeError.hidden = true;
		input.removeAttribute('aria-invalid');
		validateCode();
	},
	options,
);
form.addEventListener(
	'submit',
	(event) => {
		lastAction = 'join';
		if (!onlineReady) {
			event.preventDefault();
			event.stopImmediatePropagation();
			return;
		}
		if (/^\d{6}$/.test(input.value)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		codeError.textContent = 'Введите 6 цифр.';
		codeError.hidden = false;
		input.setAttribute('aria-invalid', 'true');
		input.focus();
	},
	options,
);
requiredElement('opening-search-find').addEventListener(
	'click',
	() => {
		lastAction = 'queue';
	},
	options,
);
requiredElement('opening-search-create').addEventListener(
	'click',
	() => {
		lastAction = 'host';
	},
	options,
);
requiredElement('opening-search-retry').addEventListener(
	'click',
	() => {
		if (lastAction === 'join') form.requestSubmit();
		else
			requiredElement(
				lastAction === 'host' ? 'opening-search-create' : 'opening-search-find',
			).click();
	},
	options,
);
requiredElement('opening-search-bot').addEventListener(
	'click',
	() => {
		cancelOnline();
		navigate('bot', false);
		uiSfx('ui-tap');
	},
	options,
);

requiredElement('opening-copy-code').addEventListener(
	'click',
	async () => {
		if (!invitation) return;
		const status = requiredElement('opening-copy-status');
		try {
			await navigator.clipboard.writeText(invitation);
			status.textContent = 'Код скопирован';
		} catch {
			status.textContent =
				'Не удалось скопировать. Выделите код и скопируйте вручную.';
		}
	},
	options,
);
requiredElement('opening-share-code').hidden =
	typeof navigator.share !== 'function';
requiredElement('opening-share-code').addEventListener(
	'click',
	async () => {
		if (!invitation) return;
		const url = new URL(location.href);
		url.search = '';
		url.hash = '';
		url.searchParams.set('join', invitation);
		try {
			await navigator.share({ title: 'Русские шашки', url: url.href });
		} catch (error) {
			if (!(error instanceof DOMException && error.name === 'AbortError'))
				requiredElement('opening-copy-status').textContent =
					'Не удалось отправить ссылку. Скопируйте код.';
		}
	},
	options,
);

for (const note of dialog.querySelectorAll('.play-online-rules'))
	note.textContent = `${clockLabel()} на игрока · Цвет — автоматически`;
const initialCode = new URLSearchParams(location.search).get('join');
if (initialCode && /^\d{6}$/.test(initialCode)) input.value = initialCode;
const observer = new MutationObserver(refreshBack);
for (const id of ['opening-play', 'opening-online'])
	observer.observe(requiredElement(id), {
		attributes: true,
		attributeFilter: ['disabled', 'aria-busy'],
	});

export const playMenu = {
	setOnlineReady(ready: boolean) {
		onlineReady = ready;
		refreshBack();
	},
	setCount(count: number | null) {
		const label = requiredElement('opening-site-count');
		const text = count === null ? 'Нет данных' : String(count);
		if (label.textContent !== text) label.textContent = text;
	},
	setSearch(next: SearchPhase, seconds: number, code: string) {
		phase = next;
		if (
			next === 'friend-joining' &&
			new URLSearchParams(location.search).has('join')
		) {
			const url = new URL(location.href);
			url.searchParams.delete('join');
			history.replaceState(history.state, '', url);
		}
		const view = searchCopy(next);
		if (next === 'idle') return view;
		if (next === 'human-menu') navigate('human');
		else if (
			next === 'friend-enter' ||
			next === 'friend-miss' ||
			next === 'friend-invalid'
		) {
			codeError.hidden = next === 'friend-enter';
			codeError.textContent =
				next === 'friend-invalid'
					? 'Введите 6 цифр.'
					: 'Приглашение не найдено. Проверьте код.';
			if (codeError.hidden) input.removeAttribute('aria-invalid');
			else input.setAttribute('aria-invalid', 'true');
			navigate('enter', next === 'friend-enter');
		} else if (next === 'friend-wait') {
			if (invitation !== code)
				requiredElement('opening-copy-status').textContent = '';
			invitation = /^\d{6}$/.test(code) ? code : '';
			requiredElement('opening-room-code').hidden = !invitation;
			requiredElement('opening-room-status').textContent = invitation
				? 'Ждём друга'
				: 'Создаём приглашение…';
			requiredElement('opening-room-digits').textContent = invitation;
			navigate('room', page === 'friend');
		} else {
			if (next === 'friend-joining') lastAction = 'join';
			const copy = requiredElement('opening-search-copy');
			if (copy.textContent !== view.title) copy.textContent = view.title;
			const elapsed = requiredElement('opening-search-elapsed');
			elapsed.hidden =
				next !== 'searching' && next !== 'waiting' && next !== 'timeout-offer';
			elapsed.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
			const detail = requiredElement('opening-search-detail');
			detail.textContent =
				next === 'timeout-offer'
					? 'Поиск продолжается'
					: next === 'offline'
						? 'Проверьте подключение и попробуйте снова.'
						: next === 'found'
							? 'Готовим партию…'
							: '';
			detail.hidden = !detail.textContent;
			requiredElement('opening-search-bot').hidden = !view.showBot;
			requiredElement('opening-search-retry').hidden = next !== 'offline';
			navigate(
				'search',
				(next === 'searching' || next === 'waiting') && page !== 'search',
			);
		}
		return view;
	},
};

if (owned()) {
	const saved = String(history.state.playPage);
	page =
		saved === 'bot' || saved === 'friend' || saved === 'enter'
			? saved
			: 'choose';
	history.replaceState({ ...history.state, playPage: page }, '');
	render();
} else root.dataset.menuPage = 'main';
syncSkill();
if (import.meta.hot)
	import.meta.hot.dispose(() => {
		controls.abort();
		observer.disconnect();
	});
