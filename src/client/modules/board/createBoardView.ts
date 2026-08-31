import type Phaser from 'phaser';
import { layout } from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import { sameSquare } from '@/client/shared/sameSquare';
import type { IPosition, ISquare } from '@/rules';
import type { IBoardView } from './IBoardView';

export function createBoardView(
	scene: Phaser.Scene,
	onSquare: (square: ISquare) => void,
): IBoardView {
	const squares: {
		row: number;
		col: number;
		rect: Phaser.GameObjects.Rectangle;
	}[] = [];
	const highlights: Phaser.GameObjects.Rectangle[] = [];
	const pieces: Phaser.GameObjects.Arc[] = [];
	let originX = 0;
	let originY = 0;
	let squareSize = 0;

	for (let row = 0; row < layout.rankCount; row += 1) {
		for (let col = 0; col < layout.rankCount; col += 1) {
			const dark = (row + col) % 2 === 0;
			const rect = scene.add.rectangle(
				0,
				0,
				8,
				8,
				dark ? palette.darkSquare : palette.lightSquare,
			);
			rect.setDepth(0);
			rect.setInteractive();
			rect.on('pointerdown', () => {
				onSquare({ row, col });
			});
			squares.push({ row, col, rect });
		}
	}

	function squareCenter(square: ISquare): { x: number; y: number } {
		return {
			x: originX + square.col * squareSize + squareSize / 2,
			y:
				originY +
				(layout.rankCount - 1 - square.row) * squareSize +
				squareSize / 2,
		};
	}

	function clear(objects: Phaser.GameObjects.GameObject[]): void {
		for (const object of objects) {
			object.destroy();
		}
		objects.length = 0;
	}

	function layoutBoard(width: number, height: number): void {
		const availableHeight = Math.max(height - layout.statusHeight, 1);
		const boardSize = Math.min(width, availableHeight) * 0.92;
		squareSize = boardSize / layout.rankCount;
		originX = (width - boardSize) / 2;
		originY = layout.statusHeight + (availableHeight - boardSize) / 2;
		for (const square of squares) {
			const center = squareCenter(square);
			square.rect.setPosition(center.x, center.y);
			square.rect.setDisplaySize(squareSize, squareSize);
		}
	}

	function sync(
		position: IPosition,
		destinations: ISquare[],
		selected: ISquare | null,
	): void {
		clear(highlights);
		clear(pieces);
		const marked = [...destinations];
		if (selected) {
			marked.push(selected);
		}
		for (const square of marked) {
			const center = squareCenter(square);
			const color =
				selected && sameSquare(square, selected)
					? palette.selected
					: palette.highlight;
			const highlight = scene.add.rectangle(
				center.x,
				center.y,
				squareSize,
				squareSize,
				color,
				layout.highlightAlpha,
			);
			highlight.setDepth(1);
			highlights.push(highlight);
		}
		for (let row = 0; row < layout.rankCount; row += 1) {
			for (let col = 0; col < layout.rankCount; col += 1) {
				const piece = position.squares[row][col];
				if (!piece) {
					continue;
				}
				const center = squareCenter({ row, col });
				const isHuman = piece.side === 'white';
				const circle = scene.add.circle(
					center.x,
					center.y,
					squareSize * layout.pieceRadiusRatio,
					isHuman ? palette.human : palette.bot,
				);
				circle.setStrokeStyle(
					Math.max(2, squareSize * 0.05),
					isHuman ? palette.humanStroke : palette.botStroke,
				);
				circle.setDepth(2);
				pieces.push(circle);
				if (piece.kind === 'king') {
					const mark = scene.add.circle(
						center.x,
						center.y,
						squareSize * layout.kingMarkRatio,
						palette.kingMark,
					);
					mark.setDepth(3);
					pieces.push(mark);
				}
			}
		}
	}

	return {
		sync,
		layout: layoutBoard,
	};
}
