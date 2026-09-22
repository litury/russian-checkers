import { createInitialPosition, type IPosition } from '@/rules';
import { applyPly, type RecordedPly } from './replay';
import type { MatchRow } from './matchHistory';

export function outcomeLabel(row: Pick<MatchRow, 'winner' | 'color'>): string {
 if (row.winner === null) return 'Без результата';
 if (row.winner === 'draw') return 'Ничья';
 return row.winner === row.color ? 'Победа' : 'Поражение';
}

/** 1 полуход, 2 полухода, 5 полуходов, 11 полуходов, 21 полуход. */
export function halfMoveCount(count: number): string {
 const mod10 = count % 10;
 const mod100 = count % 100;
 const word = mod10 === 1 && mod100 !== 11 ? 'полуход'
  : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'полухода'
  : 'полуходов';
 return `${count} ${word}`;
}

export function incompleteReplayCopy(count: number): string {
 const mod10 = count % 10;
 const mod100 = count % 100;
 const verb = mod10 === 1 && mod100 !== 11 ? 'Доступен'
  : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'Доступны'
  : 'Доступно';
 return `Неполная запись. ${verb} ${halfMoveCount(count)} до пропуска или повреждения. Дальнейшие позиции не восстановлены.`;
}

export function isMatchRow(value: unknown): value is MatchRow {
 if (!value || typeof value !== 'object') return false;
 const r = value as MatchRow;
 return typeof r.id === 'string' && r.id.length > 0 && typeof r.startedAt === 'string'
  && ['bot', 'online'].includes(r.mode) && ['white', 'black'].includes(r.color)
  && (r.winner === null || ['white', 'black', 'draw'].includes(r.winner))
  && Number.isSafeInteger(r.plies) && r.plies >= 0;
}

const pieces = (p: IPosition) => p.squares.flat().filter(Boolean).length;
/** Preserve only a legally replayable prefix. Never silently advance over a damaged move. */
export function buildHistoryReplay(raw: unknown[], expected: number) {
 const positions = [createInitialPosition()];
 const notation: string[] = [];
 const plies: RecordedPly[] = [];
 for (const value of raw) {
  if (!value || typeof value !== 'object') break;
  const ply = value as RecordedPly;
  if (!['white', 'black'].includes(ply.side) || typeof ply.from !== 'string'
   || !Array.isArray(ply.path) || !ply.path.length || !ply.path.every(s => typeof s === 'string')) break;
  const prev = positions[positions.length - 1];
  const next = applyPly(prev, ply);
  if (!next) break;
  notation.push([ply.from, ...ply.path].join(pieces(next) < pieces(prev) ? ':' : '-'));
  positions.push(next);
  plies.push(ply);
 }
 return { positions, notation, plies, incomplete: plies.length !== raw.length || raw.length !== expected };
}
