import type { Side } from '@/rules';

/** Screen Y of a square centre. Rules row 0 stays white's first rank. */
export function boardCellY(
 originY: number,
 cell: number,
 row: number,
 facing: Side,
): number {
 return facing === 'black'
  ? originY + (row + 0.5) * cell
  : originY + (7.5 - row) * cell;
}

export function visualRowStep(facing: Side, key: 'ArrowUp' | 'ArrowDown'): number {
 if (key === 'ArrowUp') return facing === 'black' ? -1 : 1;
 return facing === 'black' ? 1 : -1;
}
