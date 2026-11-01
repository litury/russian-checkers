export type ClockBanks = { white: number; black: number };

export function isClockBanks(value: unknown): value is ClockBanks {
	if (!value || typeof value !== 'object') return false;
	const banks = value as ClockBanks;
	return [banks.white, banks.black].every(bank =>
		typeof bank === 'number' && Number.isFinite(bank) && bank >= 0 && bank <= Number.MAX_SAFE_INTEGER,
	);
}
