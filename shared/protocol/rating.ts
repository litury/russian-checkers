export interface RatingSummary {
	rating: number;
	games: number;
	provisional: boolean;
}

export interface RatingChange {
	before: number;
	after: number;
	delta: number;
	provisional: boolean;
}

export function isRatingChange(value: unknown): value is RatingChange {
	if (!value || typeof value !== 'object') return false;
	const change = value as RatingChange;
	return (
		[change.before, change.after, change.delta].every(Number.isSafeInteger) &&
		change.after - change.before === change.delta &&
		typeof change.provisional === 'boolean'
	);
}
