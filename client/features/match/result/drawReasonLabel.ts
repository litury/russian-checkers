import type { DrawReason } from '@/shared/rules/drawReason';

const labels: Record<DrawReason, string> = {
	draw_repetition: 'Позиция повторилась трижды',
	draw_stable_5: 'По 5 ходов без взятий и превращений',
	draw_stable_30: 'По 30 ходов без взятий и превращений',
	draw_stable_60: 'По 60 ходов без взятий и превращений',
	draw_kings_15: 'По 15 ходов только дамками, без взятий',
	draw_kings_25: 'По 25 ходов только дамками, без взятий',
	draw_three_kings_15: 'Три дамки не взяли одинокую дамку за 15 ходов',
	draw_stronger_15: 'Сильнейшая сторона не взяла дамку за 15 ходов',
};

export function drawReasonLabel(reason: string | null | undefined): string | null {
	return reason && Object.hasOwn(labels, reason) ? labels[reason as DrawReason] : null;
}
