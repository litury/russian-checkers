export const orcTimeLowMs = 10_000;

export function orcTimeLow(ownMs: number, already: boolean): boolean {
 return !already && ownMs > 0 && ownMs < orcTimeLowMs;
}

export function orcOutcomeLine(kind: 'flag' | 'rules' | 'resign', humanWon: boolean):
 'time-up' | 'victory' | 'defeat' {
 if (kind === 'flag') return humanWon ? 'victory' : 'time-up';
 if (kind === 'resign') return 'defeat';
 return humanWon ? 'victory' : 'defeat';
}
