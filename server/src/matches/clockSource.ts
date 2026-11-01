export function createMatchTime(
	wallNow: () => number = Date.now,
	monotonicNow: () => number = () => performance.now(),
): () => number {
	const epoch = wallNow();
	const origin = monotonicNow();
	return () => Math.floor(epoch + monotonicNow() - origin);
}
