export interface Rating {
	rating: number;
	deviation: number;
	volatility: number;
}

export const initialRating: Rating = {
	rating: 1500,
	deviation: 350,
	volatility: 0.06,
};
const scale = 173.7178;
const tau = 0.5;

export function inactiveRating(player: Rating, days: number): Rating {
	return {
		...player,
		deviation: Math.min(
			350,
			scale *
				Math.sqrt(
					(player.deviation / scale) ** 2 +
						Math.max(0, Math.floor(days)) * player.volatility ** 2,
				),
		),
	};
}

export function updateRating(
	player: Rating,
	results: { opponent: Rating; score: number }[],
): Rating {
	if (!results.length) return inactiveRating(player, 1);
	const mean = (player.rating - 1500) / scale;
	const deviation = player.deviation / scale;
	let information = 0;
	let improvement = 0;
	for (const { opponent, score } of results) {
		if (![0, 0.5, 1].includes(score)) throw new Error('Invalid rating score');
		const weight =
			1 / Math.sqrt(1 + (3 * (opponent.deviation / scale) ** 2) / Math.PI ** 2);
		const expected = Math.max(
			1e-12,
			Math.min(
				1 - 1e-12,
				1 / (1 + Math.exp(-weight * (mean - (opponent.rating - 1500) / scale))),
			),
		);
		information += weight ** 2 * expected * (1 - expected);
		improvement += weight * (score - expected);
	}
	const variance = 1 / information;
	const delta = variance * improvement;
	const anchor = Math.log(player.volatility ** 2);
	const objective = (value: number) => {
		const exponential = Math.exp(value);
		const total = deviation ** 2 + variance + exponential;
		return (
			(exponential * (delta ** 2 - total)) / (2 * total ** 2) -
			(value - anchor) / tau ** 2
		);
	};
	let lower = anchor;
	let upper =
		delta ** 2 > deviation ** 2 + variance
			? Math.log(delta ** 2 - deviation ** 2 - variance)
			: anchor - tau;
	if (delta ** 2 <= deviation ** 2 + variance) {
		let steps = 1;
		while (objective(upper) < 0 && steps < 1000) upper = anchor - ++steps * tau;
	}
	let lowerValue = objective(lower);
	let upperValue = objective(upper);
	let iterations = 0;
	while (Math.abs(upper - lower) > 0.000001) {
		if (++iterations > 1000) throw new Error('Rating convergence failed');
		const middle =
			lower + ((lower - upper) * lowerValue) / (upperValue - lowerValue);
		const middleValue = objective(middle);
		if (middleValue * upperValue <= 0) {
			lower = upper;
			lowerValue = upperValue;
		} else lowerValue /= 2;
		upper = middle;
		upperValue = middleValue;
	}
	const volatility = Math.exp(lower / 2);
	const preDeviation = Math.sqrt(deviation ** 2 + volatility ** 2);
	const nextDeviation = 1 / Math.sqrt(1 / preDeviation ** 2 + 1 / variance);
	const next = {
		rating: 1500 + scale * (mean + nextDeviation ** 2 * improvement),
		deviation: scale * nextDeviation,
		volatility,
	};
	if (!Object.values(next).every(Number.isFinite))
		throw new Error('Invalid rating calculation');
	return next;
}
