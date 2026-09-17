import { expect, it } from 'vitest';
import { boardCellY, visualRowStep } from './boardFacing';

it('keeps white home rank at the bottom and black home rank at the bottom when facing black', () => {
 expect(boardCellY(0, 10, 0, 'white')).toBe(75);
 expect(boardCellY(0, 10, 7, 'white')).toBe(5);
 expect(boardCellY(0, 10, 7, 'black')).toBe(75);
 expect(boardCellY(0, 10, 0, 'black')).toBe(5);
 expect(visualRowStep('white', 'ArrowUp')).toBe(1);
 expect(visualRowStep('black', 'ArrowUp')).toBe(-1);
});
