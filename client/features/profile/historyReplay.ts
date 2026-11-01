import { createInitialPosition, type IPosition } from '@/shared/rules';
import { applyPly, type RecordedPly } from '@/shared/protocol/replay';
import type { MatchRow } from '@/shared/protocol/matchHistory';
import { isClockBanks, type ClockBanks } from '@/shared/protocol/clockBanks';

export function outcomeLabel(row: Pick<MatchRow, 'winner' | 'color'>): string {
 if (row.winner === null) return 'Без результата';
 if (row.winner === 'draw') return 'Ничья';
 return row.winner === row.color ? 'Победа' : 'Поражение';
}

export function historyReason(row: Pick<MatchRow, 'winner' | 'color' | 'endReason'>): string {
 const won = row.winner === row.color;
 switch (row.endReason) {
  case 'resign': return won ? 'Соперник сдался' : 'Вы сдались';
  case 'flag': return won ? 'У соперника закончилось время' : 'У вас закончилось время';
  case 'agreement': return 'По соглашению игроков';
  case 'timeout': return row.winner === 'draw' ? 'Игроки не вернулись' : won ? 'Соперник не вернулся' : 'Вы не вернулись';
  case 'rules': return row.winner === 'draw' ? 'Ничья по правилам' : 'По позиции на доске';
  case 'cancelled': return 'Приглашение отменено';
  case 'not_started': return 'Партия не началась';
  case 'server_interruption': return 'Сбой сервера · Без результата';
  default: return '';
 }
}

export function historyClockLabel(banks: ClockBanks | null): string {
 if (!banks) return 'Часы не записаны';
 const format = (milliseconds: number) => {
  const tenths = Math.floor(milliseconds / 100);
  return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')},${tenths % 10}`;
 };
 return `Белые ${format(banks.white)} · Чёрные ${format(banks.black)}`;
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

const pieces = (p: IPosition) => p.squares.flat().filter(Boolean).length;
/** Preserve only a legally replayable prefix. Never silently advance over a damaged move. */
export function buildHistoryReplay(raw: unknown[], expected: number) {
 const positions = [createInitialPosition()];
 const notation: string[] = [];
 const plies: RecordedPly[] = [];
 const clocks: (ClockBanks | null)[] = [];
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
  const banks = (value as { clocks?: unknown }).clocks;
  clocks.push(isClockBanks(banks) ? { ...banks } : null);
 }
 return { positions, notation, plies, clocks, incomplete: plies.length !== raw.length || raw.length !== expected };
}
