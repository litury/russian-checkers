import type { IPosition, Side } from '@/rules';
import { isThreefold } from '@/rules/draw';

export function verdictReason(winner: Side | 'draw', human: Side, kind: string, position: IPosition, keys: string[]): string {
	const won = winner === human;
	if (kind === 'timeout') return winner === 'draw' ? 'Игроки не вернулись в партию' : won ? 'Соперник не вернулся в партию' : 'Вы не вернулись в партию';
	if (kind === 'resign') return won ? 'Соперник сдался' : 'Вы сдались';
	if (kind === 'flag') return won ? 'У соперника закончилось время' : 'У вас закончилось время';
	if (kind !== 'rules') return 'Партия завершена';
	if (winner === 'draw') return isThreefold(keys) ? 'Позиция повторилась трижды' : 'Ничья по правилам';
	const loser = winner === 'white' ? 'black' : 'white';
	const hasPieces = position.squares.some(row => row.some(piece => piece?.side === loser));
	return hasPieces ? won ? 'У соперника не осталось ходов' : 'У вас не осталось ходов' : won ? 'У соперника не осталось шашек' : 'У вас не осталось шашек';
}
