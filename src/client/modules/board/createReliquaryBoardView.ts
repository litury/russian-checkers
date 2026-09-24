import Phaser from 'phaser';
import { logicalSize } from '@/client/app/displayDensity';
import { pieceSprites } from '@/client/config/layout';
import { reliquaryLayout } from '@/client/config/reliquaryLayout';
import { boardFrame, syncBoardCoords } from './boardCoords';
import { boardCellY, visualRowStep } from './boardFacing';
import './boardCoords.css';
import { sameSquare } from '@/client/shared/sameSquare';
import { type IMove, type IPosition, type ISquare, type Side, legalMoves } from '@/rules';
import type { IBoardView } from './IBoardView';
import { markerMoves } from './reliquaryHints';
import {
	ARROW_CELL,
	ARROW_CORNER,
	ARROW_TEXTURE,
	arrowRotation,
	drawReliquaryMarker,
	MARKER_ARROW,
	MARKER_STAPLES,
	screenStep,
} from './reliquaryMarkers';
import { MarkerMotion } from './reliquaryMotion';
import { OpeningMoveHint } from '@/client/app/openingMoveHint';
import { SelectionMotion } from './selectionMotion';
import { selectionV2Frame } from './selectionV2';
import { KingFire } from './kingFire';
import { pieceStepSfx } from '@/client/app/pieceSfx';
import { kingFireAssets } from './kingFireAssets';

type PieceView = {
	square: ISquare;
	kind: 'man' | 'king';
	side: 'white' | 'black';
	motion: SelectionMotion;
	group: Phaser.GameObjects.Container;
	seal: Phaser.GameObjects.Image;
	sprite: Phaser.GameObjects.Image;
	outline: Phaser.GameObjects.Image;
};
const key = (s: ISquare): string => `${s.row},${s.col}`;
const reduced = (): boolean =>
	globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Reliquary renderer with approved baked king-fire v3 and selection v2. */
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
		'selection_king-seal',
		...Object.keys(kingFireAssets).map(name => `king-fire_${name}`),
		...['white', 'black'].flatMap(side => Array.from({ length: 56 }, (_, i) => `selection_${side}-${String(i).padStart(2, '0')}`)),
		MARKER_STAPLES,
		MARKER_ARROW,
	]) {
		if (!scene.textures?.exists?.(texture)) continue;
		scene.textures.get(texture)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
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
	const introMarks = scene.add.graphics().setDepth(7.9).setName('opening-move-hint');
	const intro = new OpeningMoveHint();
	let introProgress = 0, introReduced = false;

	const interaction = scene.add.graphics().setDepth(9);
	const hintMotion = new MarkerMotion();

	const pieces = new Map<string, PieceView>();
	const kingFire = new KingFire(scene);
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
	let landedView: PieceView | null = null;
	let enabled = false;
	let generation = 0;
	let position: IPosition | null = null;
	let selected: ISquare | null = null;
	let choices: IMove[] = [];
	let hover: ISquare | null = null;
	let focus: ISquare = { row: 2, col: 0 };
	let facing: Side = 'white';
	let keyboard = false;
	const cellBox = (s: ISquare) => ({
		x: field.originX + (s.col + 0.5) * field.cell,
		y: boardCellY(field.originY, field.cell, s.row, facing),
		w: field.cell,
		h: field.cell,
	});
	type MarkerImage = Phaser.GameObjects.Image;
	const pools = {
		intro: [] as MarkerImage[],
		marks: [] as MarkerImage[],
	};
	const used = { intro: 0, marks: 0 };
	const release = (which: 'intro' | 'marks'): void => {
		for (const img of pools[which]) img.setVisible(false);
		used[which] = 0;
	};
	const take = (which: 'intro' | 'marks', texture: string, depth: number): MarkerImage => {
		let img = pools[which][used[which]];
		if (!img) {
			img = scene.add.image(0, 0, texture);
			pools[which].push(img);
		}
		used[which] += 1;
		return img.setTexture(texture).setName(texture).setDepth(depth).setVisible(true).setAlpha(1).setRotation(0);
	};
	const placeStaple = (square: ISquare, alpha: number, depth: number, which: 'intro' | 'marks'): void => {
		if (alpha <= 0 || !hasTexture(MARKER_STAPLES)) return;
		const box = cellBox(square);
		take(which, MARKER_STAPLES, depth)
			.setPosition(box.x, box.y)
			.setOrigin(0.5, 0.5)
			.setDisplaySize(box.w, box.h)
			.setAlpha(alpha);
	};
	const placeArrow = (from: ISquare, to: ISquare): void => {
		if (!hasTexture(MARKER_ARROW)) return;
		const step = screenStep(from, to, facing);
		if (!step.dx || !step.dy) return;
		const box = cellBox(from);
		const long = Math.max(box.w, box.h) * ARROW_CELL;
		const scale = long / Math.max(ARROW_TEXTURE.w, ARROW_TEXTURE.h);
		take('marks', MARKER_ARROW, 8.2)
			.setOrigin(0.5, 0.5)
			.setDisplaySize(ARROW_TEXTURE.w * scale, ARROW_TEXTURE.h * scale)
			.setRotation(arrowRotation(step.dx, step.dy))
			.setPosition(box.x + step.dx * box.w * ARROW_CORNER, box.y + step.dy * box.h * ARROW_CORNER);
	};
	const drawIntro = () => {
		introMarks.clear();
		release('intro');
		if (!visible || moving || isInputBlocked()) return;
		for (const {square, alpha} of intro.sample(introProgress, introReduced, selected))
			placeStaple(square, alpha, 7.9, 'intro');
	};
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
		release('marks');
		drawIntro();

		if (!visible) return;
		if (selected) placeStaple(selected, 1, 8, 'marks');
		const seen = new Set<string>();
		const arrows = new Set<string>();

		const routes = markerMoves(choices, selected);
		for (const move of routes) {
			const victims = targets(move);
			for (const sq of victims) {
				const id = `target:${key(sq)}`;
				if (!seen.has(id)) placeStaple(sq, 1, 8, 'marks');
				seen.add(id);
			}
			const land = move.path[0];
			if (!land) continue;
			const step = screenStep(move.from, land, facing);
			const id = `${step.dx},${step.dy}`;
			if (!arrows.has(id)) placeArrow(move.from, land);
			arrows.add(id);
		}
		drawInteraction();
	};
	const hasTexture = (key: string): boolean =>
		typeof scene.textures.exists !== 'function' || scene.textures.exists(key);
	const pieceTexture = (kind: PieceView['kind'], side: PieceView['side']): string =>
		kind === 'king'
			? side === 'white'
				? pieceSprites.kingLight
				: pieceSprites.kingDark
			: side === 'white'
				? pieceSprites.manLight
				: pieceSprites.manDark;
	const renderPiece = (view: PieceView): void => {
		const king = view.kind === 'king';
		const frame = `selection_${view.side}-${String(selectionV2Frame(view.motion.progress)).padStart(2, '0')}`;
		// Disk fallback only if selection frames missing (interactive boot failed) — no mid-match swap.
		const selectionReady = hasTexture(frame);
		const texture = selectionReady ? frame : pieceTexture(view.kind, view.side);
		view.sprite.setTexture(texture).setName('selection-piece')
			.setData('square', { ...view.square }).setData('kind', view.kind)
			.setData('side', view.side).setData('progress', view.motion.progress);
		view.outline.setTexture(texture);
		view.seal.setVisible(king && hasTexture('selection_king-seal'));
		if (selectionReady) {
			// Both ranks share approved v2 geometry; seal is TEMPORARY until crown art arrives.
			const scale = (35 / 648) * field.cell / 44;
			for (const image of [view.sprite, view.outline])
				image.setOrigin(365 / 724, 679 / 724).setPosition(0, 17.6 * field.cell / 44).setDisplaySize(724 * scale, 724 * scale);
			view.outline.setVisible(false);
			view.seal.setPosition(0, -selectionV2Frame(view.motion.progress) * scale).setDisplaySize(field.cell, field.cell).setData('temporaryRank', true);
		} else {
			for (const image of [view.sprite, view.outline])
				image.setOrigin(0.5, 0.5).setPosition(0, 0).setDisplaySize(field.cell * 0.86, field.cell * 0.86);
			view.outline.setVisible(false);
			view.seal.setPosition(0, 0).setDisplaySize(field.cell, field.cell).setData('temporaryRank', true);
		}
	};
	const place = (view: PieceView): void => {
		const box = cellBox(view.square);
		view.group.setPosition(box.x, box.y);
		renderPiece(view);
	};
	const remove = (view: PieceView): void => {
		kingFire.remove(view);
		scene.tweens.killTweensOf(view.group);
		view.group.destroy();
	};
	const sync: IBoardView['sync'] = (
		next,
		highlights,
		selection,
		options = [],
		availability,
	) => {
		if (moving) return;
		position = next;
		selected = selection;
		if (availability !== undefined) {
			intro.update(availability);
			introProgress = 1;
		}
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
					const sprite = scene.add.image(0, 0, texture);
					const outline = scene.add.image(0, 0, texture).setTint(0x141210);
					const sealKey = hasTexture('selection_king-seal') ? 'selection_king-seal' : texture;
					const seal = scene.add.image(0, 0, sealKey).setName('king-seal').setVisible(false);
					view = {
						square,
						kind: piece.kind, side: piece.side, motion: new SelectionMotion(),
						sprite, outline, seal,
						group: scene.add.container(0, 0, [outline, sprite, seal]).setDepth(4).setName('selection-piece-group'),
					};
					pieces.set(id, view);
				}
				view.kind = piece.kind;
				view.side = piece.side;
				const open = Boolean(selected && sameSquare(selected, square));
				view.motion.select(open, reduced() || (open && view === landedView));
				view.group.setVisible(visible);
				place(view);
				kingFire.rest(view, visible && !isInputBlocked() && view.kind === 'king', cellBox(square), field.cell, reduced());
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
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			const next = focus.row + visualRowStep(facing, event.key);
			focus = { ...focus, row: Math.max(0, Math.min(7, next)) };
		}
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
		kingFire.clear();
		field = reliquaryLayout(width, height);
		ground.setSize(width, height);

		board
			.setPosition(
				field.originX - boardFrame.padX * field.scale,
				field.originY - boardFrame.padTop * field.scale,
			)
			.setDisplaySize(
				boardFrame.width * field.scale,
				boardFrame.height * field.scale,
			);
		syncBoardCoords(canvas.parentElement, field, facing, visible);
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
		if (!moving) for (const view of pieces.values()) {
			place(view);
			kingFire.rest(view, visible && !isInputBlocked() && view.kind === 'king', cellBox(view.square), field.cell, reduced());
		}
		draw();
	};
	const reset = (): void => {
		kingFire.clear();
		intro.clear();
		introMarks.clear();
		release('intro');
		release('marks');

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
		landedView = null;

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
		intro.clear();
		drawIntro();
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
				landedView = view;
				onDone();
				if (generation !== run) return;
				landedView = null;
				if (pieces.get(key(view.square)) === view) {
					view.motion.select(Boolean(selected && sameSquare(selected, view.square)), reduced());
					renderPiece(view);
				}
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
			release('marks');
			placeStaple(from, 1, 8, 'marks');
			placeArrow(from, land);
			if (victim) placeStaple(victim, 1, 8, 'marks');
			kingFire.takeoff(view, view.kind === 'king', cellBox(from), field.cell, reduced());
			pieceStepSfx(view.kind === 'king', Boolean(victim), view.side, victim ? pieces.get(key(victim))?.side : undefined);
			onTakeoff?.(Boolean(victim));
			const finish = (): void => {
				if (generation !== run) return;
				if (victim && !retainCaptured) {
					const taken = pieces.get(key(victim));
					if (taken) remove(taken);
					pieces.delete(key(victim));
				}
				kingFire.move(cellBox(land));
				kingFire.land();
				view.square = land;
				if (view.kind === 'man' && land.row === (view.side === 'white' ? 7 : 0)) {
					view.kind = 'king';
					kingFire.ignite(view, cellBox(land), field.cell, reduced());
				}
				place(view);
				kingFire.rest(view, visible && view.kind === 'king', cellBox(land), field.cell, reduced());
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
				targets: view.group,
				x: box.x,
				y: box.y,
				duration: 160,
				ease: 'Sine.easeInOut',
				// Phaser calls this once per property: y is declared after x above.
				onUpdate: (_tween: Phaser.Tweens.Tween, _target: object, property: string) => {
					if (generation === run && property === 'y') kingFire.move(view.group, scene.game.loop?.delta ?? 0);
				},
				onComplete: finish,
			});
		};
		step(0);
	};
	const updateHints = (_time: number, delta: number): void => {
		if (!visible || isInputBlocked()) kingFire.clear();
		kingFire.update(delta, reduced());
		for (const view of pieces.values()) {
			if (visible && !isInputBlocked()) kingFire.rest(view, view.kind === 'king', cellBox(view.square), field.cell, reduced());
			view.motion.advance(delta, reduced());
			renderPiece(view);
		}
		drawIntro();
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
		if (typeof document !== 'undefined' && document.getElementById)
			document.getElementById('board-coords')?.remove();
	});
	layout(logicalSize(scene).width, logicalSize(scene).height);
	return {
		clearOpeningHint: () => { intro.clear(); introMarks.clear(); release('intro'); },
		startOpeningHint: (position, local) => { intro.start(position, local); introProgress = 0; introReduced = reduced(); drawIntro(); },
		paintOpeningHint: (progress, motionReduced) => { introProgress = progress; introReduced = motionReduced; drawIntro(); },
		sync,
		layout,
		setFacing: (side) => {
			facing = side;
			const size = logicalSize(scene);
			layout(size.width, size.height);
		},
		reset,
		playMove,
		press: () => {},
		deny: () => {},
		playFlagBurst: (_square, onDone) => onDone(),
		setWaitingIdle: () => {},
		notePly: () => {},
		setPlayfieldVisible: (on) => {
			if (!on) reset();
			visible = on;
			board.setVisible(on);
			shadow.setVisible(on);
			syncBoardCoords(canvas.parentElement, field, facing, visible);
			for (const { rect } of cells) {
				if (on) rect.setInteractive();
				else rect.disableInteractive();
			}
			for (const view of pieces.values()) {
				view.group.setVisible(on);
			}
			if (!on) {
				intro.clear();
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
