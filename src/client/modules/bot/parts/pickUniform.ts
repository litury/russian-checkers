export function pickUniform<T>(
	items: T[],
	random: () => number,
): T | undefined {
	if (items.length === 0) {
		return undefined;
	}
	const index = Math.min(items.length - 1, Math.floor(random() * items.length));
	return items[index];
}
