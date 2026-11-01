import type { RatingChange } from '@/shared/protocol/rating';

export function ratingChangeLabel(change: RatingChange): string {
	const delta = change.delta > 0 ? `+${change.delta}` : String(change.delta);
	return `Рейтинг ${change.after} · ${delta}${change.provisional ? ' · предварительный' : ''}`;
}
