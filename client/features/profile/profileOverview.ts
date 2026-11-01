import { requiredElement } from '@/client/platform/browser/dom';
import { ensureGuest, loadStats } from '@/client/platform/network/cloud';

export function bindProfileOverview() {
	const games = requiredElement('profile-games');
	const wins = requiredElement('profile-wins');
	const status = requiredElement('profile-stats');
	const retry = requiredElement<HTMLButtonElement>('profile-stats-retry');
	const rating = requiredElement('opening-rating-number');
	const ratingStatus = requiredElement('opening-rating-status');
	const ratingValue = requiredElement('opening-rating-value');
	const ratingRetry = requiredElement<HTMLButtonElement>('opening-rating-retry');
	let loading = false;
	let hasData = false;
	async function refresh() {
		if (loading) return;
		loading = true;
		retry.hidden = true;
		ratingRetry.hidden = true;
		status.textContent = '';
		ratingValue.setAttribute('aria-busy', 'true');
		if (!hasData) {
			games.textContent = wins.textContent = '—';
			rating.textContent = '—';
			rating.removeAttribute('data-empty');
			ratingStatus.textContent = 'Загрузка…';
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
				ratingStatus.textContent = '';
			} else {
				rating.textContent = '—';
				ratingStatus.textContent = 'Рейтинг недоступен';
				retry.hidden = false;
				ratingRetry.hidden = false;
			}
		} catch {
			status.textContent = hasData ? 'Не удалось обновить данные' : 'Данные недоступны';
			ratingStatus.textContent = hasData ? 'Не удалось обновить' : 'Рейтинг недоступен';
			ratingRetry.hidden = false;
			retry.hidden = false;
		} finally {
			ratingValue.setAttribute('aria-busy', 'false');
			loading = false;
		}
	}
	retry.addEventListener('click', () => void refresh());
	ratingRetry.addEventListener('click', () => void refresh());
	document.addEventListener('damka:rating-updated', () => void refresh());
	void refresh();
	return { refresh };
}
