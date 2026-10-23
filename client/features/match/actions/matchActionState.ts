import type { MatchPhase } from '../matchSession';

interface ActionState {
	phase: MatchPhase;
	paused: boolean;
	flagLock: boolean;
	countingIn: boolean;
}

export interface UndoState extends ActionState {
	online: boolean;
	undoDepth: number;
	moving: boolean;
	humanChain: boolean;
}

export function canResign(state: ActionState): boolean {
	return (
		(state.phase === 'human' || state.phase === 'bot') &&
		!state.paused &&
		!state.flagLock &&
		!state.countingIn
	);
}

export function undoBlockedReason(state: UndoState): string | null {
	if (state.phase === 'title') return 'Партия ещё не началась.';
	if (state.phase === 'over') return 'Партия завершена.';
	if (state.online) return 'В онлайн-партии отмена недоступна.';
	if (state.paused) return 'Игра на паузе.';
	if (state.flagLock) return 'Ожидаем результат партии.';
	if (state.countingIn) return 'Подготовка партии.';
	if (state.phase === 'bot') return 'Дождитесь ответа компьютера.';
	if (state.moving) return 'Дождитесь завершения хода.';
	if (state.humanChain) return 'Сначала завершите взятие.';
	if (state.undoDepth === 0)
		return 'После вашего хода и ответа компьютера можно вернуть позицию и часы.';
	return null;
}
