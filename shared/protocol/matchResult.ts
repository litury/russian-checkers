import type { Side } from '../rules/index.ts';

export type MatchResult = Side | 'draw' | 'aborted';
export const MATCH_PROTOCOL_VERSION = 2;

export function isMatchResult(value: unknown): value is MatchResult {
	return (
		value === 'white' ||
		value === 'black' ||
		value === 'draw' ||
		value === 'aborted'
	);
}
