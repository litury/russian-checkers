import type { ISquare } from '@/rules';

export function squareAlg(square: ISquare): string {
 return `${String.fromCharCode(97 + square.col)}${square.row + 1}`;
}

export function parseAlg(text: string): ISquare | null {
 const m = /^([a-h])([1-8])$/.exec(text.trim());
 if (!m) return null;
 return { col: m[1].charCodeAt(0) - 97, row: Number(m[2]) - 1 };
}
