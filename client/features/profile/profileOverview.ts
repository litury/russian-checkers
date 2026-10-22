import { requiredElement } from '@/client/platform/browser/dom';
import { ensureGuest, loadStats } from '@/client/platform/network/cloud';

export function bindProfileOverview() {
	const games = requiredElement('profile-games');
	const wins = requiredElement('profile-wins');
	const status = requiredElement('profile-stats');
	const retry = requiredElement<HTMLButtonElement>('profile-stats-retry');
	let loading = false;
	async function refresh() {
		if (loading) return;
		loading = true;
		retry.hidden = true;
		status.textContent = 'Загрузка статистики…';
		games.textContent = wins.textContent = '—';
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
			status.textContent = '';
		} catch {
			status.textContent = 'Статистика недоступна';
			retry.hidden = false;
		} finally {
			loading = false;
		}
	}
	retry.addEventListener('click', () => void refresh());
	return { refresh };
}
