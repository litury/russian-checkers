import type Phaser from 'phaser';
import { layout, tableSprite } from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import { sameSquare } from '@/client/shared/sameSquare';
import type { IPosition, ISquare } from '@/rules';
import type { IBoardView } from './IBoardView';

export function createBoardView(
	scene: Phaser.Scene,
	onSquare: (square: ISquare) => void,
): IBoardView {
	const table = scene.add.image(0, 0, tableSprite.key);
	table.setOrigin(0, 0);
	table.setDepth(0);
	const squares: {
		row: number;
		col: number;
		rect: Phaser.GameObjects.Rectangle;
	}[] = [];
	const highlights: Phaser.GameObjects.Rectangle[] = [];
	const pieces: Phaser.GameObjects.Arc[] = [];
	const grid = scene.add.graphics();
	grid.setDepth(1);
	let originX = 0;
	let originY = 0;
	let cellW = 0;
	let cellH = 0;

	for (let row = 0; row < layout.rankCount; row += 1) {
		for (let col = 0; col < layout.rankCount; col += 1) {
			const rect = scene.add.rectangle(0, 0, 8, 8, palette.darkSquare, 0);
			rect.setDepth(2);
			rect.setInteractive();
			rect.on('pointerdown', () => {
				onSquare({ row, col });
			});
			squares.push({ row, col, rect });
		}
	}

	function cellBox(square: ISquare): {
		x: number;
		y: number;
		w: number;
		h: number;
	} {
		const visRow = layout.rankCount - 1 - square.row;
		const left = Math.round(originX + square.col * cellW);
		const right = Math.round(originX + (square.col + 1) * cellW);
		const top = Math.round(originY + visRow * cellH);
		const bottom = Math.round(originY + (visRow + 1) * cellH);
		return {
			x: (left + right) / 2,
			y: (top + bottom) / 2,
			w: right - left,
			h: bottom - top,
		};
	}

	function clear(objects: Phaser.GameObjects.GameObject[]): void {
		for (const object of objects) {
			object.destroy();
		}
		objects.length = 0;
	}

	function drawGrid(): void {
		grid.clear();
		if (!layout.debugGrid) {
			return;
		}
		grid.lineStyle(1, palette.selected, 0.85);
		for (let i = 0; i <= layout.rankCount; i += 1) {
			const x = originX + i * cellW;
			const y = originY + i * cellH;
			grid.lineBetween(originX, y, originX + cellW * layout.rankCount, y);
			grid.lineBetween(x, originY, x, originY + cellH * layout.rankCount);
		}
	}

	function layoutBoard(width: number, height: number): void {
		const scale =
			width < height ? width / tableSprite.frameW : height / tableSprite.frameH;
		const frameScreenW = tableSprite.frameW * scale;
		const frameScreenH = tableSprite.frameH * scale;
		const frameScreenX = (width - frameScreenW) / 2;
		const frameScreenY = (height - frameScreenH) / 2;
		const imageX = Math.round(frameScreenX - tableSprite.frameX * scale);
		const imageY = Math.round(frameScreenY - tableSprite.frameY * scale);
		table.setPosition(imageX, imageY);
		table.setDisplaySize(
			Math.round(tableSprite.width * scale),
			Math.round(tableSprite.height * scale),
		);
		const scaleX = table.displayWidth / tableSprite.width;
		const scaleY = table.displayHeight / tableSprite.height;
		originX = imageX + tableSprite.boardX * scaleX;
		originY = imageY + tableSprite.boardY * scaleY;
		cellW = (tableSprite.boardW * scaleX) / layout.rankCount;
		cellH = (tableSprite.boardH * scaleY) / layout.rankCount;
		for (const square of squares) {
			const box = cellBox(square);
			square.rect.setPosition(box.x, box.y);
			square.rect.setDisplaySize(box.w, box.h);
		}
		drawGrid();
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
			const box = cellBox(square);
			const color =
				selected && sameSquare(square, selected)
					? palette.selected
					: palette.highlight;
			const highlight = scene.add.rectangle(
				box.x,
				box.y,
				box.w,
				box.h,
				color,
				layout.highlightAlpha,
			);
			highlight.setDepth(3);
			highlights.push(highlight);
		}
		const pieceSize = Math.min(cellW, cellH);
		for (let row = 0; row < layout.rankCount; row += 1) {
			for (let col = 0; col < layout.rankCount; col += 1) {
				const piece = position.squares[row][col];
				if (!piece) {
					continue;
				}
				const box = cellBox({ row, col });
				const isHuman = piece.side === 'white';
				const circle = scene.add.circle(
					box.x,
					box.y,
					pieceSize * layout.pieceRadiusRatio,
					isHuman ? palette.human : palette.bot,
				);
				circle.setStrokeStyle(
					Math.max(2, pieceSize * 0.05),
					isHuman ? palette.humanStroke : palette.botStroke,
				);
				circle.setDepth(4);
				pieces.push(circle);
				if (piece.kind === 'king') {
					const mark = scene.add.circle(
						box.x,
						box.y,
						pieceSize * layout.kingMarkRatio,
						palette.kingMark,
					);
					mark.setDepth(5);
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
