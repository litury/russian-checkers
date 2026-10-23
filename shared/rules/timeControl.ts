export const timeControls = {
	'1+0': { initialMs: 60_000, incrementMs: 0 },
	'1+1': { initialMs: 60_000, incrementMs: 1000 },
	'3+2': { initialMs: 180_000, incrementMs: 2000 },
	'5+3': { initialMs: 300_000, incrementMs: 3000 },
} as const;

export type TimeControlId = keyof typeof timeControls;
export type SelectableTimeControl = Exclude<TimeControlId, '1+0'>;
export const defaultTimeControl: SelectableTimeControl = '3+2';

export function isTimeControl(value: unknown): value is TimeControlId {
	return typeof value === 'string' && Object.hasOwn(timeControls, value);
}

export function isSelectableTimeControl(
	value: unknown,
): value is SelectableTimeControl {
	return isTimeControl(value) && value !== '1+0';
}

export function timeControlDescription(id: TimeControlId): string {
	const control = timeControls[id];
	return `${control.initialMs / 60_000} мин на игрока · +${control.incrementMs / 1000} с за ход`;
}
