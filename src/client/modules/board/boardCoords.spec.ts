import { expect, it } from 'vitest';
import { squareAlg } from '@/online/notation';
import history from '../../app/matchHistory.css?raw';
import html from '../../../../index.html?raw';
import {
	boardFrame,
	boardFrameName,
	boardFrameRect,
	boardFrameSheet,
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

it('picks a frame on the shared sheet and does not flip the files', () => {
	expect(boardFrameSheet).toBe('reliquary_board-frames');
	expect(boardFrameName('white')).toBe('white');
	expect(boardFrameName('black')).toBe('black');
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

it('uses the same facing frames in history and leaves no HTML captions', () => {
	expect(history).toContain("url('../modules/board/reliquary/board-frames.webp')");
	expect(history).toContain('200% 100%');
	expect(history).toContain('data-facing="black"');
	expect(history).not.toContain('glyphs.webp');
	expect(html).toContain('data-facing="white"');
	expect(html).not.toContain('data-glyph');
	expect(html).not.toContain('>a</span>');
	expect(html).not.toContain('>8</span>');
	expect(html).toContain('id="match-history-notation"');
	expect(history).not.toContain('mh-files');
	expect(history).toContain('mh-last');
	expect(boardFrame.width).toBe(380);
	expect(boardFrame.height).toBe(418);
});
