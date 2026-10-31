import type { MatchOutcome, MatchPhase } from '../matchSession';

export interface PanelState {
	kind:
		| 'preparing'
		| 'turn'
		| 'capture'
		| 'continuing'
		| 'waiting'
		| 'disconnected'
		| 'paused'
		| 'finished';
	title: string;
	compactTitle: string;
	detail: string;
	tone: 'neutral' | 'active' | 'warning' | 'win' | 'loss';
}

export function matchPanelState(input: {
	phase: MatchPhase;
	preparing: boolean;
	paused: boolean;
	serverPause?: 'shutdown' | 'storage';
	waitingResult: boolean;
	humanTurn: boolean;
	capture: boolean;
	continuing: boolean;
	disconnectedTime: string;
	outcome: MatchOutcome | null;
}): PanelState {
	const state = (
		kind: PanelState['kind'],
		title: string,
		compactTitle = title,
		detail = '',
		tone: PanelState['tone'] = 'neutral',
	): PanelState => ({ kind, title, compactTitle, detail, tone });
	if (input.outcome) {
		const outcome = input.outcome;
		const draw = outcome.winner === 'draw' || outcome.winner === 'aborted';
		const won = outcome.winner === outcome.humanSide;
		const title = outcome.winner === 'aborted' ? 'Партия прервана' : draw ? 'Ничья' : won ? 'Победа' : 'Поражение';
		return state(
			'finished',
			title,
			title,
			outcome.reason,
			draw ? 'neutral' : won ? 'win' : 'loss',
		);
	}
	if (input.serverPause) return state('paused',
		input.serverPause === 'storage' ? 'Сбой сервера' : 'Восстанавливаем партию',
		input.serverPause === 'storage' ? 'Сбой сервера' : 'Восстановление',
		'Часы остановлены', 'warning');
	if (input.phase === 'over' || input.waitingResult)
		return state('waiting', 'Ожидаем результат', 'Ждём результат');
	if (input.disconnectedTime)
		return state(
			'disconnected',
			'Соперник отключился',
			`Нет связи ${input.disconnectedTime}`,
			`Часы идут · ${input.disconnectedTime}`,
			'warning',
		);
	if (input.paused) return state('paused', 'Пауза');
	if (input.preparing)
		return state('preparing', 'Подготовка партии', 'Подготовка');
	if (!input.humanTurn) return state('turn', 'Ход соперника');
	if (input.continuing)
		return state(
			'continuing',
			'Продолжите взятие',
			'Продолжайте',
			'',
			'active',
		);
	if (input.capture)
		return state('capture', 'Обязательное взятие', 'Нужно взять', '', 'active');
	return state('turn', 'Ваш ход', 'Ваш ход', '', 'active');
}
