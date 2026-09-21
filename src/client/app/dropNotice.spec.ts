import { expect, it } from 'vitest';
import { dropNoticeLine } from './dropNotice';

it('formats the remaining grace from dropUntil, not a local default', () => {
 expect(dropNoticeLine(70_000, 10_000)).toBe('Соперник потерял связь · 1:00');
 expect(dropNoticeLine(40_500, 10_000)).toBe('Соперник потерял связь · 0:31');
 expect(dropNoticeLine(undefined, 10_000)).toBe('');
 expect(dropNoticeLine(0, 10_000)).toBe('');
 expect(dropNoticeLine(9_000, 10_000)).toBe('');
});

it('counts grace from serverNow so a fast client clock cannot hide the line', () => {
 expect(dropNoticeLine(70_000, 5_000_000, 10_000, 5_000_000)).toBe('Соперник потерял связь · 1:00');
 expect(dropNoticeLine(70_000, 5_029_000, 10_000, 5_000_000)).toBe('Соперник потерял связь · 0:31');
 expect(dropNoticeLine(70_000, 5_000_000, 70_000, 5_000_000)).toBe('');
});
