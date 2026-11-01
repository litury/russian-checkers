import type { IPosition, Side } from '@/shared/rules';
import type { MatchResult } from '@/shared/protocol/matchResult';
import { drawReason } from '@/shared/rules/draw';
import { drawReasonLabel } from './drawReasonLabel';

export function verdictReason(winner: MatchResult, human: Side, kind: string, position: IPosition, keys: string[]): string {
	if (winner === 'aborted' && kind === 'cancelled') return 'Приглашение отменено. Результат не засчитан.';
	if (winner === 'aborted' && kind === 'not_started') return 'Партия не началась. Результат не засчитан.';
	if (winner === 'aborted') return 'Сбой сервера. Результат не засчитан.';
	if (winner === 'draw') {
		const label = drawReasonLabel(kind === 'rules' ? drawReason(position, keys) : kind);
		if (label) return label;
	}
	const won = winner === human;
	if (kind === 'agreement') return 'По соглашению игроков';
	if (kind === 'timeout') return winner === 'draw' ? 'Игроки не вернулись в партию' : won ? 'Соперник не вернулся в партию' : 'Вы не вернулись в партию';
	if (kind === 'resign') return won ? 'Соперник сдался' : 'Вы сдались';
	if (kind === 'flag') return won ? 'У соперника закончилось время' : 'У вас закончилось время';
	if (kind !== 'rules') return 'Партия завершена';
	if (winner === 'draw') return 'Ничья по правилам';
	const loser = winner === 'white' ? 'black' : 'white';
	const hasPieces = position.squares.some(row => row.some(piece => piece?.side === loser));
	return hasPieces ? won ? 'У соперника не осталось ходов' : 'У вас не осталось ходов' : won ? 'У соперника не осталось шашек' : 'У вас не осталось шашек';
}
