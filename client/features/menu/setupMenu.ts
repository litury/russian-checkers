import { bindDialogNavigation } from '@/client/platform/browser/dialogNavigation';
import { requiredElement as byId } from '@/client/platform/browser/dom';
import type {} from './startupContract';

const rulesNavigation = bindDialogNavigation(
	byId<HTMLDialogElement>('opening-help-dialog'),
);
if (import.meta.hot) import.meta.hot.dispose(rulesNavigation.dispose);
window.checkersFlavor = { setState() {} };
window.checkersRules = {
	open: () => {
		const dialog = byId<HTMLDialogElement>('opening-help-dialog');
		dialog.querySelectorAll('template').forEach((template) => {
			template.replaceWith(template.content.cloneNode(true));
		});
		rulesNavigation.open();
	},
};
byId('opening-retry').onclick = () => location.reload();
const play = byId<HTMLButtonElement>('opening-play');
const online = byId<HTMLButtonElement>('opening-online');
const setCta = (button: HTMLButtonElement, name: string, busy: boolean) => {
	const label = button.querySelector('.opening-cta-label');
	const text = busy ? 'Загрузка…' : name;
	if (label) label.textContent = text;
	else button.textContent = text;
	button.disabled = busy;
	button.setAttribute('aria-busy', busy ? 'true' : 'false');
	if (busy) button.setAttribute('aria-label', name);
	else button.removeAttribute('aria-label');
};
window.checkersStartup = {
	watchdog: 0,
	framePresented: false,
	engineLoaded: false,
	presented() {
		window.checkersStartup.framePresented = true;
		// Record a native activation during the remaining module wait. Busy is not
		// ready: do not promise the engine until import resolves, or lose the tap.
		setCta(play, 'Начать партию', false);
		play.disabled = false;
		online.disabled = false;
		window.checkersStartup.unlock();
	},
	engineReady() {
		window.checkersStartup.engineLoaded = true;
		window.checkersStartup.unlock();
	},
	pendingPlay: false,
	pendingOnline: false,
	playCommitted: false,
	playIntent: null,
	onlineIntent: null,
	// Press instant captured before the engine module loads; replayed on flush.
	playIntentAt: null,
	onlineIntentAt: null,
	source: 'play',
	fail(message) {
		clearTimeout(window.checkersStartup.watchdog);
		window.checkersStartup.pendingPlay = false;
		window.checkersStartup.pendingOnline = false;
		window.checkersStartup.playCommitted = false;
		window.checkersStartup.playIntent = null;
		window.checkersStartup.onlineIntent = null;
		window.checkersStartup.playIntentAt = null;
		window.checkersStartup.onlineIntentAt = null;
		window.checkersFlavor?.setState('error');
		byId('opening-status').hidden = false;
		byId('opening-error').hidden = false;
		byId('opening-error').textContent = message;
		byId('opening-loading-status').textContent = message;
		byId('opening-mode-status').textContent = message;
		byId('opening-mode-status').hidden = false;
		setCta(play, 'Начать партию', false);
		play.disabled = true;
		play.hidden = true;
		setCta(online, 'С человеком', false);
		online.disabled = true;
		byId('opening-retry').hidden = false;
	},
	// Ready means both a presented menu and an evaluated engine module.
	unlock() {
		if (
			play.hidden ||
			!window.checkersStartup.framePresented ||
			!window.checkersStartup.engineLoaded
		)
			return;
		// One-tap intent: queued or in-flight start must keep honest wait UI — never calm «Играть».
		if (
			window.checkersStartup.pendingPlay ||
			window.checkersStartup.playCommitted
		) {
			window.checkersStartup.waitPlay();
			return;
		}
		setCta(play, 'Начать партию', false);
		play.hidden = false;
		byId('opening-retry').hidden = true;
		if (window.checkersStartup.pendingOnline)
			window.checkersStartup.waitOnline();
	},
	waitPlay() {
		const armed = window.checkersStartup.source === 'online' ? online : play;
		const name = armed === online ? 'С человеком' : 'Начать партию';
		if (armed.hidden) return;
		window.checkersStartup.playCommitted = true;
		setCta(armed, name, true);
		// Loading copy stays on the pressed button and the sr-only status. No plaque.
		window.checkersStartup.status('Загружаем доску и шашки…');
		byId('opening-status').hidden = true;
		byId('opening-error').hidden = true;
	},
	waitOnline() {
		if (online.hidden) return;
		window.checkersStartup.source = 'online';
		window.checkersStartup.pendingOnline = true;
		setCta(online, 'С человеком', true);
		window.checkersStartup.status('Загружаем доску и шашки…');
		byId('opening-status').hidden = true;
		byId('opening-error').hidden = true;
	},
	idlePlay() {
		if (
			play.hidden ||
			window.checkersStartup.pendingPlay ||
			(window.checkersStartup.playCommitted &&
				window.checkersStartup.source !== 'online')
		)
			return;
		setCta(play, 'Начать партию', false);
	},
	idleOnline() {
		if (
			window.checkersStartup.pendingOnline ||
			(window.checkersStartup.playCommitted &&
				window.checkersStartup.source === 'online')
		)
			return;
		setCta(online, 'С человеком', false);
	},
	ready() {
		// Engine module is present. Hide the load banner; do not announce a finished match.
		window.checkersStartup.status('Выберите сторону и начните игру.');
		byId('opening-status').hidden = true;
		byId('opening-error').hidden = true;
	},
	slow() {
		// Slow transfer is not an import failure and must not take the HTML-first CTA.
		// Retry shares Play's steel slot; unhiding it steals pointer events. fail() is
		// the only path that hides Play and then shows Retry.
		const playAvailable = !play.hidden;
		window.checkersStartup.status(
			playAvailable
				? play.disabled
					? 'Загрузка продолжается. Можно подождать.'
					: 'Загрузка продолжается. Можно подождать или начать игру.'
				: 'Загрузка продолжается. Можно подождать или повторить загрузку.',
		);
		byId('opening-status').hidden = true;
		if (playAvailable) {
			byId('opening-retry').hidden = true;
			return;
		}
		byId('opening-retry').hidden = false;
	},
	progress(message) {
		window.checkersStartup.status(message);
		byId('opening-status').hidden = true;
		byId('opening-error').hidden = true;
	},
	// Search and other callers must not turn ordinary copy into a load error.
	status(message) {
		byId('opening-loading-status').textContent = message;
		const waiting =
			window.checkersStartup.pendingPlay ||
			window.checkersStartup.pendingOnline ||
			window.checkersStartup.playCommitted;
		byId('opening-mode-status').textContent = waiting ? message : '';
		byId('opening-mode-status').hidden = !waiting;
		if (
			waiting &&
			!byId('opening').classList.contains('is-departing') &&
			(message.startsWith('Доска и шашки: ') ||
				message.startsWith('Загрузка: '))
		) {
			const button = window.checkersStartup.source === 'online' ? online : play;
			const label = button.querySelector('.opening-cta-label');
			// Keep named stages short enough for the narrow mobile steel button.
			const stageLabels: Record<string, string> = {
				'Загрузка: маркеры и панели…': 'Панели…',
				'Загрузка: подготовка взаимодействия…': 'Управление…',
			};
			if (label)
				label.textContent =
					stageLabels[message] || `Загрузка ${message.split(': ')[1]}`;
		}
	},
};
play.onclick = (event) => {
	if (play.hidden || play.disabled) return;
	window.checkersStartup.source = 'play';
	if (typeof window.checkersStartup.playIntent === 'function')
		window.checkersStartup.playIntent(event);
	else {
		// No engine yet: keep the press instant, the flush replays it as play-intent.
		window.checkersStartup.playIntentAt =
			event && Number.isFinite(event.timeStamp) ? event.timeStamp : null;
		window.checkersStartup.pendingPlay = true;
		window.checkersStartup.waitPlay();
	}
};
online.disabled = true;
online.onclick = (event) => {
	if (online.hidden || online.disabled) return;
	window.checkersStartup.source = 'online';
	if (typeof window.checkersStartup.onlineIntent === 'function')
		window.checkersStartup.onlineIntent(event);
	else {
		window.checkersStartup.onlineIntentAt =
			event && Number.isFinite(event.timeStamp) ? event.timeStamp : null;
		window.checkersStartup.pendingOnline = true;
		window.checkersStartup.waitOnline();
	}
};
window.checkersStartup.progress('Загружаем игру…');
// Slow transfer is not an import failure: keep a queued start, and do not cover Play.
window.checkersStartup.watchdog = setTimeout(
	() => window.checkersStartup.slow(),
	12000,
);
