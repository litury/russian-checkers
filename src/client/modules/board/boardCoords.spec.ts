import { expect, it } from 'vitest';
import { squareAlg } from '@/online/notation';
import history from '../../app/matchHistory.css?raw';
import html from '../../../../index.html?raw';
import {
	boardFrame,
	boardFrameRect,
	coordGlyphOrder,
	coordGlyphPosition,
	coordGlyphSheet,
	fileBottomRatio,
	fileLabels,
	rankLabel,
	visualRankLabels,
} from './boardCoords';
import cssSource from './boardCoords.css?raw';

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

it('maps each square name to its own cell on one 8×2 sheet', () => {
	expect(coordGlyphOrder().join('')).toBe(
		`${fileLabels.join('')}${[0, 1, 2, 3, 4, 5, 6, 7].map(rankLabel).join('')}`,
	);
	expect(coordGlyphSheet).toEqual({ cols: 8, rows: 2 });
	expect(coordGlyphPosition('a')).toBe('0% 0%');
	expect(coordGlyphPosition('h')).toBe('100% 0%');
	expect(coordGlyphPosition('1')).toBe('0% 100%');
	expect(coordGlyphPosition('8')).toBe('100% 100%');
	expect(coordGlyphPosition('b')).toBe(`${Number((100 / 7).toFixed(6))}% 0%`);
	expect(coordGlyphPosition('e')).toBe(coordGlyphPosition('5').replace('100%', '0%'));
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
	const css = cssSource.replace(/\s+/g, '');
	const pct = (part: number, whole: number) =>
		((part / whole) * 100).toFixed(5);
	expect(css).toContain(`left:${pct(boardFrame.padX, boardFrame.width)}%`);
	expect(css).toContain(`top:${pct(boardFrame.padTop, boardFrame.height)}%`);
	expect(css).toContain(`width:${pct(boardFrame.field, boardFrame.width)}%`);
	expect(css).toContain(`height:${pct(boardFrame.field, boardFrame.height)}%`);
	expect(css).toContain(`bottom:${(fileBottomRatio * 100).toFixed(1)}%`);
	expect(css).toContain('background-color:#120f0c');
	expect(css).not.toMatch(/background:#/);
	expect(cssSource).toContain("url('./coords/glyphs.webp')");
	expect(cssSource).toContain(
		`background-size: ${coordGlyphSheet.cols * 100}% ${coordGlyphSheet.rows * 100}%`,
	);
	expect(cssSource).not.toContain('animation');
	expect(cssSource).not.toContain('transition');
	expect(css).toContain('color:#f1e8d4');
	expect(css).not.toContain('text-shadow');
	expect(html).toContain('class="mh-files board-coords-files"');
	expect(html).toContain('class="mh-ranks board-coords-ranks"');
	expect([...html.matchAll(/data-glyph="([^"]+)"/g)].map((match) => match[1])).toEqual([
		...fileLabels,
		...visualRankLabels('white'),
	]);
	expect(html).not.toContain('>a</span>');
	expect(html).not.toContain('>8</span>');
	expect(html).toContain('id="match-history-notation"');
	expect(history).not.toContain('mh-files');
	expect(history).toContain('mh-last');
});
