import { expect, it } from 'vitest';
import { clipPlayerName, panelClock, matchStatus } from './createHud';
it('keeps names Unicode-safe and banks as live mm:ss values', () => {
	expect(clipPlayerName('  Александр  ')).toBe('Александр');
	expect(Array.from(clipPlayerName('🙂'.repeat(20)))).toHaveLength(12);
	expect(panelClock(60)).toBe('01:00');
	expect(panelClock(7)).toBe('00:07');
	expect(panelClock(-1)).toBe('00:00');
});
it('uses an independent status for preparation, actual turn and continuation', () => {
	expect(matchStatus(true, 'human', false, false)).toBe('Подготовка к партии');
	expect(matchStatus(false, 'human', false, false)).toBe('Ваш ход');
	expect(matchStatus(false, 'human', true, false)).toBe('Нужно бить');
	expect(matchStatus(false, 'human', true, true)).toBe('Продолжайте взятие');
	expect(matchStatus(false, 'bot', true, false)).toBe('Ход соперника');
});
it('maps the bottom bank clock to the human side', async () => {
	const hud = await import('./createHud.ts?raw');
	expect(hud.default).toContain('setFacing');
	expect(hud.default).toContain("facing === 'black' ? blackSec : whiteSec");
});
