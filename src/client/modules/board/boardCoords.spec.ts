import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { squareAlg } from '@/online/notation';
import {
	boardFrame,
	boardFrameRect,
	fileBottomRatio,
	fileLabels,
	rankLabel,
	visualRankLabels,
} from './boardCoords';

it('names files and ranks with squareAlg, not a second alphabet', () => {
	expect(fileLabels.join('')).toBe(
		Array.from({ length: 8 }, (_, col) => squareAlg({ row: 0, col })[0]).join(
			'',
		),
	);
	expect(rankLabel(0)).toBe('1');
	expect(rankLabel(7)).toBe('8');
	expect(squareAlg({ row: 2, col: 4 })).toBe('e3');
});

it('puts 8–1 down the left rail for white and flips only the ranks for black', () => {
	expect(visualRankLabels('white')).toEqual([
		'8',
		'7',
		'6',
		'5',
		'4',
		'3',
		'2',
		'1',
	]);
	expect(visualRankLabels('black')).toEqual([
		'1',
		'2',
		'3',
		'4',
		'5',
		'6',
		'7',
		'8',
	]);
	expect(fileLabels.join('')).toBe('abcdefgh');
});

it('keeps the label box on the existing frame, not a new column', () => {
	const field = { originX: 20, originY: 80, scale: 1.25, cell: 55 };
	const rect = boardFrameRect(field);
	expect(rect.x).toBe(field.originX - boardFrame.padX * field.scale);
	expect(rect.y).toBe(field.originY - boardFrame.padTop * field.scale);
	expect(rect.width).toBe(boardFrame.width * field.scale);
	expect(rect.height).toBe(boardFrame.height * field.scale);
	expect(rect.x + boardFrame.padX * field.scale).toBe(field.originX);
	expect(rect.width).toBeGreaterThan(352 * field.scale);
	expect(rect.x).toBeLessThan(field.originX);
});

it('shares the history frame insets and does not replace the move list', () => {
	const css = readFileSync(
		new URL('./boardCoords.css', import.meta.url),
		'utf8',
	).replace(/\s+/g, '');
	const html = readFileSync(
		new URL('../../../../index.html', import.meta.url),
		'utf8',
	);
	const history = readFileSync(
		new URL('../../app/matchHistory.css', import.meta.url),
		'utf8',
	);
	const pct = (part: number, whole: number) =>
		((part / whole) * 100).toFixed(5);
	expect(css).toContain(`left:${pct(boardFrame.padX, boardFrame.width)}%`);
	expect(css).toContain(`top:${pct(boardFrame.padTop, boardFrame.height)}%`);
	expect(css).toContain(`width:${pct(boardFrame.field, boardFrame.width)}%`);
	expect(css).toContain(`height:${pct(boardFrame.field, boardFrame.height)}%`);
	expect(css).toContain(`bottom:${(fileBottomRatio * 100).toFixed(1)}%`);
	expect(css).toContain('background:#120f0c');
	expect(css).toContain('color:#f1e8d4');
	expect(css).not.toContain('text-shadow');
	expect(html).toContain('class="mh-files board-coords-files"');
	expect(html).toContain('class="mh-ranks board-coords-ranks"');
	expect(html).toContain(
		'<span>a</span><span>b</span><span>c</span><span>d</span><span>e</span><span>f</span><span>g</span><span>h</span>',
	);
	expect(html).toContain(
		'<span>8</span><span>7</span><span>6</span><span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>',
	);
	expect(html).toContain('id="match-history-notation"');
	expect(history).not.toContain('mh-files');
	expect(history).toContain('mh-last');
});
