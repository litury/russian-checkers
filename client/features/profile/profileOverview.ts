import { requiredElement } from '@/client/platform/browser/dom';
import { ensureGuest, loadStats } from '@/client/platform/network/cloud';

export function bindProfileOverview() {
	const games = requiredElement('profile-games');
	const wins = requiredElement('profile-wins');
	const status = requiredElement('profile-stats');
	const profileRating = requiredElement('profile-rating');
	const profileValues = requiredElement('profile-stats-values');
	const profileWarning = requiredElement('profile-stats-warning');
	const setProfileStatus = (message: string) => {
		status.textContent = message;
		profileWarning.hidden = !message;
		profileWarning.title = message;
		profileWarning.setAttribute('aria-label', message);
	};
	const rating = requiredElement('opening-rating-number');
	const ratingStatus = requiredElement('opening-rating-status');
	const ratingValue = requiredElement('opening-rating-value');
	const ratingWarning = requiredElement('opening-rating-warning');
	const setRatingStatus = (message: string, error = false) => {
		ratingStatus.textContent = message;
		ratingWarning.hidden = !error;
		ratingWarning.title = message;
		ratingWarning.setAttribute('aria-label', message);
	};
	let loading = false;
	let hasData = false;
	let lastStarted = 0;
	async function refresh() {
		if (loading) return;
		loading = true;
		lastStarted = Date.now();
		profileValues.setAttribute('aria-busy', 'true');
		ratingValue.setAttribute('aria-busy', 'true');
		if (!hasData) {
			games.textContent = wins.textContent = '—';
			profileRating.textContent = '—';
			rating.textContent = '—';
			rating.removeAttribute('data-empty');
			setRatingStatus('Загрузка…');
		}
		try {
			const guest = await ensureGuest();
			const data = guest ? await loadStats(guest) : null;
			if (
				!data ||
				![data.games, data.white_wins, data.black_wins].every(
					(value) => Number.isSafeInteger(value) && value >= 0,
				) ||
				data.white_wins + data.black_wins > data.games
			)
				throw new Error('Invalid player statistics');
			games.textContent = String(data.games);
			wins.textContent = String(data.white_wins + data.black_wins);
			hasData = true;
			const summary = data.rating;
			const valid = summary && Number.isSafeInteger(summary.rating)
				&& Number.isSafeInteger(summary.games) && summary.games >= 0 && typeof summary.provisional === 'boolean';
			rating.toggleAttribute('data-empty', Boolean(valid && !summary.games));
			if (valid) {
				rating.textContent = summary.games ? String(summary.rating) : 'Сыграйте онлайн';
				profileRating.textContent = summary.games ? String(summary.rating) : '—';
				profileRating.setAttribute('aria-label', summary.games ? String(summary.rating) : 'Нет рейтинговых партий');
				setProfileStatus('');
				setRatingStatus('');
			} else {
				rating.textContent = '—';
				profileRating.textContent = '—';
				profileRating.removeAttribute('aria-label');
				setRatingStatus('Рейтинг недоступен', true);
				setProfileStatus('Рейтинг недоступен');
			}
		} catch {
			setProfileStatus(hasData ? 'Не удалось обновить данные' : 'Данные недоступны');
			setRatingStatus(hasData ? 'Не удалось обновить рейтинг' : 'Рейтинг недоступен', true);
		} finally {
			ratingValue.setAttribute('aria-busy', 'false');
			profileValues.setAttribute('aria-busy', 'false');
			loading = false;
		}
	}
	const resume = () => {
		if (!document.hidden && Date.now() - lastStarted >= 15_000) void refresh();
	};
	window.addEventListener('online', resume);
	document.addEventListener('visibilitychange', resume);
	document.addEventListener('damka:rating-updated', () => void refresh());
	void refresh();
	return { refresh };
}
