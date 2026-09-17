import { remainingMs, type Side } from '../../src/rules/index.ts';

export const FLAG_SLACK_MS = 750;

export function turnLeft(bankMs: number, startedAt: number, now: number): number {
 return remainingMs(bankMs, startedAt, now, false);
}

export function flagDue(bankMs: number, startedAt: number, now: number, slack = FLAG_SLACK_MS): boolean {
 return turnLeft(bankMs, startedAt, now) <= slack;
}

export function flagWinner(turn: Side): Side {
 return turn === 'white' ? 'black' : 'white';
}
