import Phaser from 'phaser';
import { logicalSize } from '@/client/app/displayDensity';
import { pieceSprites } from '@/client/config/layout';
import { reliquaryLayout } from '@/client/config/reliquaryLayout';
import { sameSquare } from '@/client/shared/sameSquare';
import { type IMove, type IPosition, type ISquare, legalMoves } from '@/rules';
import type { IBoardView } from './IBoardView';
import { markerDestinations, markerMoves } from './reliquaryHints';
import { drawReliquaryMarker, type Marker } from './reliquaryMarkers';
import { MarkerMotion } from './reliquaryMotion';

type PieceView = {
	square: ISquare;
	sprite: Phaser.GameObjects.Image;
	outline: Phaser.GameObjects.Image;
};
const key = (s: ISquare): string => `${s.row},${s.col}`;
const reduced = (): boolean =>
	globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Reliquary renderer: no legacy wreaths, flames or arcs. */
export function createBoardView(
	scene: Phaser.Scene,
	onSquare: (square: ISquare) => void,
	onCancel: () => void = () => {},
	isInputBlocked: () => boolean = () => false,
): IBoardView {
	// Detailed Reliquary figures only. HUD/board retain their own NEAREST sampling.
	for (const texture of [
		pieceSprites.manLight,
		pieceSprites.manDark,
		pieceSprites.kingLight,
		pieceSprites.kingDark,
	]) {
		scene.textures.get(texture).setFilter(Phaser.Textures.FilterMode.LINEAR);
	}
	const ground = scene.add
		.tileSprite(0, 0, 64, 64, 'reliquary_slate_tile')
		.setOrigin(0)
		.setDepth(0);
	ground.setTileScale(0.5);
	const shadow = scene.add
		.image(0, 0, 'reliquary_board_shadow')
		.setOrigin(0)
		.setDepth(0.1);
	const board = scene.add
		.image(0, 0, 'reliquary_board')
		.setOrigin(0)
		.setDepth(1.1);
	const marks = scene.add.graphics().setDepth(8);
	const interaction = scene.add.graphics().setDepth(9);
	const hintMotion = new MarkerMotion();
	const status = scene.add
		.text(0, 0, '', {
			fontFamily: 'sans-serif',
			fontSize: '18px',
			color: '#eee4ca',
			backgroundColor: '#121618',
			padding: { x: 10, y: 6 },
		})
		.setOrigin(0.5, 1)
		.setDepth(10)
		.setVisible(false);
	const pieces = new Map<string, PieceView>();
	const cells: { square: ISquare; rect: Phaser.GameObjects.Rectangle }[] = [];
	const canvas = scene.game.canvas;
	const oldTabIndex = canvas.getAttribute('tabindex');
	const oldLabel = canvas.getAttribute('aria-label');
	let field = reliquaryLayout(
		logicalSize(scene).width,
		logicalSize(scene).height,
	);
	let visible = true;
	let moving = false;
	let movingView: PieceView | null = null;
	let enabled = false;
	let generation = 0;
	let position: IPosition | null = null;
	let selected: ISquare | null = null;
	let choices: IMove[] = [];
	let hover: ISquare | null = null;
	let focus: ISquare = { row: 2, col: 0 };
	let keyboard = false;
	const cellBox = (s: ISquare) => ({
		x: field.originX + (s.col + 0.5) * field.cell,
		y: field.originY + (7.5 - s.row) * field.cell,
		w: field.cell,
		h: field.cell,
	});
	const paint = (square: ISquare, state: Marker): void =>
		drawReliquaryMarker(marks, cellBox(square), state, hintMotion.elapsed);
	const label = (): void => {
		canvas.setAttribute(
			'aria-label',
			`Шашечная доска. Клетка ${String.fromCharCode(97 + focus.col)}${focus.row + 1}. Стрелки — перемещение, Enter или пробел — выбор и ход, Escape — отмена выбора до начала взятия.`,
		);
	};
	const drawInteraction = (): void => {
		interaction.clear();
		if (!visible || !enabled || moving) return;

		if (keyboard && document.activeElement === canvas)
			drawReliquaryMarker(interaction, cellBox(focus), 'focus');
	};
	// A capture is an occupied enemy square on a legal diagonal, not merely a long king move.
	const targets = (move: IMove): ISquare[] => {
		if (!position) return [];
		const side = position.squares[move.from.row]?.[move.from.col]?.side;
		const result = new Map<string, ISquare>();
		let from = move.from;
		for (const land of move.path) {
			const dr = Math.sign(land.row - from.row),
				dc = Math.sign(land.col - from.col);
			for (let i = 1; i < Math.abs(land.row - from.row); i++) {
				const sq = { row: from.row + dr * i, col: from.col + dc * i };
				const piece = position.squares[sq.row]?.[sq.col];
				if (piece && piece.side !== side) result.set(key(sq), sq);
			}
			from = land;
		}
		return [...result.values()];
	};
	const draw = (): void => {
		marks.clear();
		status.setVisible(
			visible && choices.some((move) => targets(move).length > 0),
		);
		status.setText('Нужно бить');
		if (!visible) return;
		if (selected) paint(selected, 'selected');
		const seen = new Set<string>();
		if (!selected) {
			for (const move of choices) {
				if (!targets(move).length || seen.has(key(move.from))) continue;
				paint(move.from, 'selected');
				seen.add(key(move.from));
			}
		}
		for (const move of markerMoves(choices, selected)) {
			const victims = targets(move);
			for (const sq of victims) {
				const id = `target:${key(sq)}`;
				if (!seen.has(id)) paint(sq, 'target');
				seen.add(id);
			}
			for (const land of markerDestinations([move])) {
				const state = victims.length ? 'landing' : 'move';
				const id = `${state}:${key(land)}`;
				if (!seen.has(id)) paint(land, state);
				seen.add(id);
			}
		}
		drawInteraction();
	};
	const place = (view: PieceView): void => {
		const box = cellBox(view.square);
		view.sprite.setPosition(box.x, box.y).setDisplaySize(box.w, box.h);
		view.outline.setPosition(box.x, box.y).setDisplaySize(box.w + 2, box.h + 2);
	};
	const remove = (view: PieceView): void => {
		scene.tweens.killTweensOf(view.sprite);
		scene.tweens.killTweensOf(view.outline);
		view.sprite.destroy();
		view.outline.destroy();
	};
	const sync: IBoardView['sync'] = (
		next,
		highlights,
		selection,
		options = [],
	) => {
		if (moving) return;
		position = next;
		selected = selection;
		enabled = visible && highlights.length > 0;
		choices = enabled ? (selected ? options : legalMoves(next)) : [];
		hintMotion.sync(
			selected && choices.length
				? JSON.stringify([next, selected, choices])
				: '',
			reduced(),
			choices.some((move) => targets(move).length > 0),
		);
		canvas.tabIndex = enabled ? 0 : -1;
		const seen = new Set<string>();
		next.squares.forEach((rank, row) => {
			rank.forEach((piece, col) => {
				if (!piece) return;
				const square = { row, col },
					id = key(square);
				seen.add(id);
				const texture =
					piece.kind === 'king'
						? piece.side === 'white'
							? pieceSprites.kingLight
							: pieceSprites.kingDark
						: piece.side === 'white'
							? pieceSprites.manLight
							: pieceSprites.manDark;
				let view = pieces.get(id);
				if (!view) {
					view = {
						square,
						sprite: scene.add.image(0, 0, texture).setDepth(4),
						outline: scene.add
							.image(0, 0, texture)
							.setTint(0x141210)
							.setDepth(3.95),
					};
					pieces.set(id, view);
				}
				view.sprite.setTexture(texture).setVisible(visible);
				view.outline.setTexture(texture).setVisible(visible);
				place(view);
			});
		});
		for (const [id, view] of pieces)
			if (!seen.has(id)) {
				remove(view);
				pieces.delete(id);
			}
		draw();
	};
	for (let row = 0; row < 8; row++)
		for (let col = 0; col < 8; col++) {
			const square = { row, col };
			const rect = scene.add
				.rectangle(0, 0, 8, 8, 0, 0)
				.setDepth(2)
				.setInteractive();
			rect.on('pointerdown', () => {
				if (!enabled || moving || isInputBlocked()) return;
				focus = square;
				canvas.focus({ preventScroll: true });
				keyboard = false;
				label();
				drawInteraction();
				onSquare(square);
			});
			rect.on('pointerover', () => {
				hover = square;
				drawInteraction();
			});
			rect.on('pointerout', () => {
				if (hover && sameSquare(hover, square)) hover = null;
				drawInteraction();
			});
			cells.push({ square, rect });
		}
	const onKey = (event: KeyboardEvent): void => {
		if (
			!enabled ||
			moving ||
			isInputBlocked() ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey
		)
			return;
		if (
			![
				'ArrowUp',
				'ArrowDown',
				'ArrowLeft',
				'ArrowRight',
				'Enter',
				' ',
				'Escape',
			].includes(event.key)
		)
			return;
		event.preventDefault();
		keyboard = true;
		hover = null;
		if (event.key === 'ArrowUp')
			focus = { ...focus, row: Math.min(7, focus.row + 1) };
		if (event.key === 'ArrowDown')
			focus = { ...focus, row: Math.max(0, focus.row - 1) };
		if (event.key === 'ArrowLeft')
			focus = { ...focus, col: Math.max(0, focus.col - 1) };
		if (event.key === 'ArrowRight')
			focus = { ...focus, col: Math.min(7, focus.col + 1) };
		if (!event.repeat && (event.key === 'Enter' || event.key === ' '))
			onSquare(focus);
		if (event.key === 'Escape') onCancel();
		label();
		drawInteraction();
	};
	const onFocus = (): void => {
		keyboard = canvas.matches(':focus-visible');
		drawInteraction();
	};
	canvas.addEventListener('keydown', onKey);
	canvas.addEventListener('focus', onFocus);
	canvas.addEventListener('blur', drawInteraction);
	label();
	const layout: IBoardView['layout'] = (width, height) => {
		field = reliquaryLayout(width, height);
		ground.setSize(width, height);
		status.setPosition(
			width / 2,
			Math.max(38, field.originY - 33 * field.scale - 8),
		);
		board
			.setPosition(
				field.originX - 14 * field.scale,
				field.originY - 33 * field.scale,
			)
			.setDisplaySize(380 * field.scale, 418 * field.scale);
		shadow
			.setPosition(
				field.originX - 46 * field.scale,
				field.originY - 65 * field.scale,
			)
			.setDisplaySize(444 * field.scale, 482 * field.scale);
		for (const { square, rect } of cells) {
			const box = cellBox(square);
			rect.setPosition(box.x, box.y).setSize(box.w, box.h);
			// Phaser local input coordinates start at top-left, not the object's origin.
			rect.setInteractive(
				new Phaser.Geom.Rectangle(0, 0, box.w, box.h),
				Phaser.Geom.Rectangle.Contains,
			);
			if (!visible) rect.disableInteractive();
		}
		if (!moving) for (const view of pieces.values()) place(view);
		draw();
	};
	const reset = (): void => {
		hintMotion.cancel();
		generation++;
		moving = false;
		enabled = false;
		selected = null;
		choices = [];
		hover = null;
		keyboard = false;
		focus = { row: 2, col: 0 };
		position = null;
		if (movingView) remove(movingView);
		movingView = null;
		status.setVisible(false);
		for (const view of pieces.values()) remove(view);
		pieces.clear();
		marks.clear();
		interaction.clear();
		canvas.tabIndex = -1;
	};
	const playMove: IBoardView['playMove'] = (
		move,
		onDone,
		onLand,
		onTakeoff,
		retainCaptured = false,
	) => {
		if (moving) return;
		const view = pieces.get(key(move.from));
		if (!view) {
			onDone();
			return;
		}
		const victims = targets(move);
		const run = generation;
		hintMotion.cancel();
		moving = true;
		movingView = view;
		selected = null;
		hover = null;
		choices = [];
		draw();
		interaction.clear();
		pieces.delete(key(move.from));
		let from = move.from;
		const step = (index: number): void => {
			if (generation !== run) return;
			const land = move.path[index];
			if (!land) {
				moving = false;
				movingView = null;
				choices = [];
				selected = null;
				pieces.set(key(view.square), view);
				draw();
				onDone();
				return;
			}
			const victim = victims.find(
				(s) =>
					Math.abs(s.row - from.row) === Math.abs(s.col - from.col) &&
					Math.sign(s.row - from.row) === Math.sign(land.row - from.row) &&
					Math.sign(s.col - from.col) === Math.sign(land.col - from.col) &&
					Math.abs(s.row - from.row) < Math.abs(land.row - from.row),
			);
			marks.clear();
			status
				.setText(index > 0 ? 'Серия взятий' : 'Нужно бить')
				.setVisible(Boolean(victim));
			paint(from, 'selected');
			paint(land, victim ? 'landing' : 'move');
			if (victim) paint(victim, 'target');
			onTakeoff?.(Boolean(victim));
			const finish = (): void => {
				if (generation !== run) return;
				if (victim && !retainCaptured) {
					const taken = pieces.get(key(victim));
					if (taken) remove(taken);
					pieces.delete(key(victim));
				}
				view.square = land;
				const texture = view.sprite.texture.key;
				const promoted =
					texture === pieceSprites.manLight && land.row === 7
						? pieceSprites.kingLight
						: texture === pieceSprites.manDark && land.row === 0
							? pieceSprites.kingDark
							: texture;
				view.sprite.setTexture(promoted);
				view.outline.setTexture(promoted);
				place(view);
				from = land;
				onLand?.(Boolean(victim));
				step(index + 1);
			};
			if (reduced()) {
				finish();
				return;
			}
			const box = cellBox(land);
			scene.tweens.add({
				targets: [view.sprite, view.outline],
				x: box.x,
				y: box.y,
				duration: 160,
				ease: 'Sine.easeInOut',
				onComplete: finish,
			});
		};
		step(0);
	};
	const updateHints = (_time: number, delta: number): void => {
		if (!hintMotion.active) return;
		hintMotion.advance(delta, reduced());
		draw();
	};
	scene.events.on('update', updateHints);
	scene.events.once('shutdown', () => {
		scene.events.off('update', updateHints);
		reset();
		canvas.removeEventListener('keydown', onKey);
		canvas.removeEventListener('focus', onFocus);
		canvas.removeEventListener('blur', drawInteraction);
		if (oldTabIndex === null) canvas.removeAttribute('tabindex');
		else canvas.setAttribute('tabindex', oldTabIndex);
		if (oldLabel === null) canvas.removeAttribute('aria-label');
		else canvas.setAttribute('aria-label', oldLabel);
	});
	layout(logicalSize(scene).width, logicalSize(scene).height);
	return {
		sync,
		layout,
		reset,
		playMove,
		press: () => {},
		deny: () => {},
		playFlagBurst: (_square, onDone) => onDone(),
		setWaitingIdle: () => {},
		notePly: () => {},
		setPlayfieldVisible: (on) => {
			visible = on;
			board.setVisible(on);
			shadow.setVisible(on);
			for (const { rect } of cells) {
				if (on) rect.setInteractive();
				else rect.disableInteractive();
			}
			for (const view of pieces.values()) {
				view.sprite.setVisible(on);
				view.outline.setVisible(on);
			}
			if (!on) {
				hintMotion.cancel();
				enabled = false;
				hover = null;
				keyboard = false;
				canvas.tabIndex = -1;
				interaction.clear();
			}
			draw();
		},
	};
}
