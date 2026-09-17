import {describe, expect, it} from 'vitest';
import {FOUND_HOLD_MS, SEARCH_TIMEOUT_MS, CONNECT_BUDGET_MS, searchCopy} from './matchmakingSearch';

describe('matchmaking search copy', () => {
	it('searching shows timer and cancel, not board preload', () => {
		const view = searchCopy('searching', 3);
		expect(view.title).toBe('Ищем соперника · 3 с');
		expect(view.showCancel).toBe(true);
		expect(view.hidePlay).toBe(true);
		expect(view.title).not.toMatch(/доск/i);
	});

	it('waiting is honest about the second player', () => {
		expect(searchCopy('waiting', 12).title).toBe('Ждём второго игрока · 12 с');
	});

	it('offline and timeout offer the documented lines', () => {
		expect(searchCopy('offline', 0).title).toBe('Нет связи с сервером');
		expect(searchCopy('offline', 0).hidePlay).toBe(false);
		const late = searchCopy('timeout-offer', 46);
		expect(late.title).toBe('Пока никого');
		expect(late.showStay).toBe(true);
		expect(late.showBot).toBe(true);
		expect(late.showCancel).toBe(false);
	});

	it('found is a short hold before the table', () => {
		expect(searchCopy('found', 0).title).toBe('Соперник найден');
		expect(FOUND_HOLD_MS).toBeGreaterThanOrEqual(500);
		expect(FOUND_HOLD_MS).toBeLessThanOrEqual(1000);
		expect(SEARCH_TIMEOUT_MS).toBe(45_000);
	});

	it('connect budget fails hung API before the 45s queue offer', () => {
		expect(CONNECT_BUDGET_MS).toBeGreaterThanOrEqual(1000);
		expect(CONNECT_BUDGET_MS).toBeLessThanOrEqual(1600);
	});
});
