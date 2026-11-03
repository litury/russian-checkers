import { requiredElement } from '@/client/platform/browser/dom';
import {
	emailRequestAsync,
	saveEmailSession,
	startNewGuestAsync,
} from '@/client/platform/network/cloud';

interface EmailStatus {
	available: boolean;
	email: string | null;
}
interface EmailChallenge {
	recoveryToken?: string;
	challengeId: string;
	expiresIn: number;
	retryAfter: number;
}
interface EmailConfirmation {
	linked: boolean;
	id: string;
	token?: string;
}

export function bindAccountUi() {
	const root = requiredElement('profile-account-pane');
	const summary = requiredElement('account-summary');
	const status = requiredElement('account-status');
	const choices = requiredElement('account-choices');
	const link = requiredElement<HTMLButtonElement>('account-link');
	const login = requiredElement<HTMLButtonElement>('account-login');
	const refresh = requiredElement<HTMLButtonElement>('account-refresh');
	const newGuest = requiredElement<HTMLButtonElement>('account-new-guest');
	const newGuestForm = requiredElement<HTMLFormElement>(
		'account-new-guest-form',
	);
	const newGuestConsent = requiredElement<HTMLInputElement>(
		'account-new-guest-consent',
	);
	const form = requiredElement<HTMLFormElement>('account-email-form');
	const title = requiredElement('account-form-title');
	const address = requiredElement<HTMLInputElement>('account-email');
	const warning = requiredElement('account-login-warning');
	const consent = requiredElement<HTMLInputElement>('account-switch-consent');
	const submit = requiredElement<HTMLButtonElement>('account-send');
	const codeForm = requiredElement<HTMLFormElement>('account-code-form');
	const destination = requiredElement('account-destination');
	const code = requiredElement<HTMLInputElement>('account-code');
	const resend = requiredElement<HTMLButtonElement>('account-resend');
	let purpose: 'link' | 'login' = 'link';
	let challenge: EmailChallenge | undefined;
	let email = '';
	let retryAt = 0;
	let busy = false;
	let configured = false;
	let linked = false;
	let invalidSession = false;
	let generation = 0;

	function update() {
		for (const control of root.querySelectorAll<
			HTMLButtonElement | HTMLInputElement
		>('button,input'))
			control.disabled = busy;
		link.disabled = busy || !configured || linked || invalidSession;
		login.disabled = busy || !configured;
		resend.disabled = busy || Date.now() < retryAt;
		resend.textContent =
			Date.now() < retryAt
				? `Повторить через ${Math.ceil((retryAt - Date.now()) / 1000)} с`
				: 'Отправить ещё раз';
	}
	function showError(_error: unknown) {
		const messages: Record<string, string> = {
			email_unavailable: 'Почта пока недоступна. Попробуйте позже.',
			invalid_email: 'Проверьте адрес почты.',
			invalid_code: 'Код неверен или истёк. Проверьте его или запросите новый.',
			rate: 'Слишком много попыток. Попробуйте позже.',
			unauthorized:
				'Не удалось подтвердить этот профиль. Не очищайте данные браузера.',
			storage:
				'Браузер не разрешил сохранить вход. Разрешите хранение данных сайта и повторите вход.',
			session_changed:
				'Профиль изменён в другой вкладке. Обновите страницу перед продолжением.',
		};
		status.textContent =
			messages[_error instanceof Error ? _error.message : ''] ??
			'Нет связи с сервером. Попробуйте ещё раз.';
	}
	async function refreshAsync() {
		const current = ++generation;
		busy = true;
		update();
		status.textContent = 'Проверяем аккаунт…';
		try {
			const result = await emailRequestAsync<EmailStatus>('status');
			if (current !== generation) return;
			configured = result.available;
			invalidSession = false;
			newGuest.hidden = true;
			linked = Boolean(result.email);
			summary.textContent = result.email
				? `Почта привязана: ${result.email}`
				: 'Сохраните доступ к рейтингу и истории на другом устройстве.';
			link.hidden = linked;
			login.textContent = linked
				? 'Войти в другой профиль'
				: 'Уже есть профиль';
			status.textContent = configured
				? ''
				: 'Привязка почты пока недоступна. Ваш текущий профиль продолжает работать.';
		} catch (error) {
			if (current === generation) {
				showError(error);
				if (error instanceof Error && error.message === 'unauthorized') {
					invalidSession = true;
					linked = false;
					link.hidden = true;
					newGuest.hidden = false;
					login.textContent = 'Войти по почте';
					summary.textContent =
						'Доступ к профилю не подтверждён. Если почта была привязана, восстановите вход.';
					try {
						const availability = await emailRequestAsync<EmailStatus>(
							'status',
							undefined,
							true,
						);
						configured = availability.available;
					} catch {
						configured = false;
					}
				}
			}
		} finally {
			if (current === generation) {
				busy = false;
				update();
			}
		}
	}
	function select(_purpose: typeof purpose) {
		purpose = _purpose;
		newGuestForm.hidden = true;
		choices.hidden = true;
		form.hidden = false;
		codeForm.hidden = true;
		status.textContent = '';
		title.textContent =
			purpose === 'link' ? 'Привязать почту' : 'Войти по почте';
		warning.hidden = purpose !== 'login';
		requiredElement('account-switch-copy').textContent = invalidSession
			? 'Войти в профиль с этой почтой. Его рейтинг и история сохранятся.'
			: 'Перейти в существующий профиль. Текущий рейтинг и история не перенесутся. Чтобы сохранить доступ к этому профилю, сначала привяжите к нему другую почту.';
		consent.required = purpose === 'login';
		consent.checked = false;
		submit.textContent = 'Получить код';
		address.focus();
	}
	async function sendAsync() {
		if (busy) return;
		busy = true;
		update();
		status.textContent = 'Запрашиваем код…';
		try {
			challenge = await emailRequestAsync<EmailChallenge>(
				'start',
				{
					email,
					purpose,
				},
				purpose === 'login',
			);
			retryAt = Date.now() + challenge.retryAfter * 1000;
			form.hidden = true;
			codeForm.hidden = false;
			code.value = '';
			destination.textContent = `Проверьте ${email}. Код действует 10 минут.`;
			status.textContent =
				purpose === 'login'
					? 'Если профиль с этой почтой существует, письмо придёт в ближайшее время.'
					: 'Если почта свободна и профиль ещё не привязан, письмо придёт в ближайшее время.';
		} catch (error) {
			showError(error);
		} finally {
			busy = false;
			update();
			if (!codeForm.hidden) code.focus();
		}
	}
	link.addEventListener('click', () => select('link'));
	login.addEventListener('click', () => select('login'));
	refresh.addEventListener('click', () => {
		void refreshAsync();
	});
	newGuest.addEventListener('click', () => {
		choices.hidden = true;
		newGuestForm.hidden = false;
		newGuestConsent.checked = false;
		status.textContent = '';
		newGuestConsent.focus();
	});
	newGuestForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (busy || !invalidSession || !newGuestForm.reportValidity()) return;
		busy = true;
		update();
		try {
			await startNewGuestAsync();
			location.reload();
		} catch (error) {
			showError(error);
		} finally {
			busy = false;
			update();
		}
	});
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		if (!form.reportValidity()) return;
		email = address.value.trim();
		void sendAsync();
	});
	resend.addEventListener('click', () => {
		if (Date.now() >= retryAt) void sendAsync();
	});
	codeForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (busy || !challenge || !codeForm.reportValidity()) return;
		busy = true;
		update();
		status.textContent = 'Проверяем код…';
		try {
			const result = await emailRequestAsync<EmailConfirmation>(
				'confirm',
				{
					challengeId: challenge.challengeId,
					code: code.value.trim(),
					recoveryToken: challenge.recoveryToken,
				},
				purpose === 'login',
			);
			if (!result.linked) {
				if (!result.token || !result.id) throw new Error('network');
				await saveEmailSession(result.id, result.token);
				location.reload();
				return;
			}
			codeForm.hidden = true;
			choices.hidden = false;
			challenge = undefined;
			await refreshAsync();
			status.textContent = 'Почта привязана. Рейтинг и история сохранены.';
			status.tabIndex = -1;
			status.focus();
		} catch (error) {
			showError(error);
		} finally {
			busy = false;
			update();
		}
	});
	for (const button of root.querySelectorAll('[data-account-cancel]'))
		button.addEventListener('click', () => {
			form.hidden = true;
			codeForm.hidden = true;
			newGuestForm.hidden = true;
			choices.hidden = false;
			challenge = undefined;
			status.textContent = '';
			(linked || invalidSession ? login : link).focus();
		});
	setInterval(() => {
		if (!root.hidden && !codeForm.hidden) update();
	}, 1000);
	return {
		open: () => {
			if (!busy && form.hidden && codeForm.hidden && newGuestForm.hidden)
				void refreshAsync();
		},
	};
}
