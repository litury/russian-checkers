import { isTimeControl, type TimeControlId } from '@/shared/rules/timeControl';

export type MatchRow = {
 timeControl?: TimeControlId;
 id: string;
 mode: 'bot' | 'online';
 winner: 'white' | 'black' | 'draw' | null;
 startedAt: string;
 color: 'white' | 'black';
 plies: number;
};

export type MatchDetail = MatchRow & {
 pliesList: { side: 'white' | 'black'; from: string; path: string[] }[];
};

export function ownColor(whiteId: string | null, blackId: string | null, me: string): 'white' | 'black' | null {
 if (whiteId === me) return 'white';
 if (blackId === me) return 'black';
 return null;
}

export function canOpenBoard(row: { plies: number }): boolean {
 return row.plies > 0;
}

export function isMatchRow(value: unknown): value is MatchRow {
	if (!value || typeof value !== 'object') return false;
	const row = value as MatchRow;
	return (row.timeControl === undefined || isTimeControl(row.timeControl)) && typeof row.id === 'string' && row.id.length > 0 && typeof row.startedAt === 'string'
		&& ['bot', 'online'].includes(row.mode) && ['white', 'black'].includes(row.color)
		&& (row.winner === null || ['white', 'black', 'draw'].includes(row.winner))
		&& Number.isSafeInteger(row.plies) && row.plies >= 0;
}
