import Phaser from 'phaser';
import { logicalSize } from '@/client/app/displayDensity';
import { pieceSprites } from '@/client/config/layout';
import { reliquaryLayout } from '@/client/config/reliquaryLayout';
import { boardFrame, boardFrameName, boardFrameSheet } from './boardCoords';
import { boardCellY, visualRowStep } from './boardFacing';
import { OpeningMoveHint } from '@/client/app/openingMoveHint';
import { pieceStepSfx } from '@/client/app/pieceSfx';
import { sameSquare } from '@/client/shared/sameSquare';
import {
	type IMove,
	type IPosition,
	type ISquare,
	legalMoves,
	type Side,
} from '@/rules';
import { cutRotation, splitNormal, splitPixels } from './captureCut';
import type { IBoardView } from './IBoardView';
import { KingFire } from './kingFire';
import { kingFireAssets } from './kingFireAssets';
import { type MarkTone, planMoveMarks } from './moveMarks';
import { markerMoves } from './reliquaryHints';
import {
	ARROW_CELL,
	ARROW_CORNER,
	ARROW_TEXTURE,
	arrowRotation,
	drawReliquaryMarker,
	MARKER_ARROW_AMBER,
	MARKER_ARROW_COPPER,
	MARKER_CUT,
	MARKER_STAPLES,
	MARKER_STAPLES_AMBER,
	MARKER_STAPLES_COPPER,
	screenStep,
} from './reliquaryMarkers';
import { MarkerMotion } from './reliquaryMotion';
import { SelectionMotion } from './selectionMotion';
import { selectionOverlayFrame, selectionOverlayTexture } from './selectionOverlay';

function ensureBoardFrames(scene: Phaser.Scene) {
	if (!scene.textures?.exists?.(boardFrameSheet)) return;
	const tex = scene.textures.get(boardFrameSheet);
	if (!tex.has('white')) tex.add('white', 0, 0, 0, 760, 836);
	if (!tex.has('black')) tex.add('black', 0, 760, 0, 760, 836);
}

type PieceView = {
	square: ISquare;
	kind: 'man' | 'king';
	side: 'white' | 'black';
	motion: SelectionMotion;
	group: Phaser.GameObjects.Container;
	seal: Phaser.GameObjects.Image;
	sprite: Phaser.GameObjects.Image;
	outline: Phaser.GameObjects.Image;
	overlay: Phaser.GameObjects.Image;
};
const key = (s: ISquare): string => `${s.row},${s.col}`;
const reduced = (): boolean =>
	globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Reliquary board. Pieces keep their real textures; a separate overlay layer marks selection. */
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
		...Object.keys(kingFireAssets).map((name) => `king-fire_${name}`),
		...['white', 'black'].flatMap((side) =>
			Array.from(
				{ length: 56 },
				(_, i) => `selection_${side}-${String(i).padStart(2, '0')}`,
			),
		),
		MARKER_STAPLES,
		MARKER_STAPLES_AMBER,
		MARKER_STAPLES_COPPER,
		MARKER_ARROW_AMBER,
		MARKER_ARROW_COPPER,
		MARKER_CUT,
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
	ensureBoardFrames(scene);
	const boardKey = scene.textures?.exists?.(boardFrameSheet)
		? boardFrameSheet
		: 'reliquary_board';
	const board = scene.add
		.image(0, 0, boardKey, boardKey === boardFrameSheet ? 'white' : undefined)
		.setOrigin(0)
		.setDepth(1.1);
	const marks = scene.add.graphics().setDepth(8);
	const introMarks = scene.add
		.graphics()
		.setDepth(7.9)
		.setName('opening-move-hint');
	const intro = new OpeningMoveHint();
	let introProgress = 0,
		introReduced = false;

	const interaction = scene.add.graphics().setDepth(9);
	const hintMotion = new MarkerMotion();

	const pieces = new Map<string, PieceView>();
	const sundered = new Set<string>();
	const falls: { image: Phaser.GameObjects.Image; textureKey?: string }[] = [];
	let cutSerial = 0;
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
	/**
	 * The promotion that ended the match keeps its fire under the result window, after the
	 * reset that clears the position, so one stable owner covers both phases.
	 */
	let finale: { owner: PieceView; square: ISquare } | null = null;
	/** Promotion of the most recent `playMove`; only the final move may arm the finale. */
	let lastPromotion: { view: PieceView; square: ISquare } | null = null;
	const cellBox = (s: ISquare) => ({
		x: field.originX + (s.col + 0.5) * field.cell,
		y: boardCellY(field.originY, field.cell, s.row, facing),
		w: field.cell,
		h: field.cell,
	});
	// The final promotion keeps the owner its fire was born with, so re-syncing the position
	// after the presentation reset resumes that same flame instead of stacking a second one.
	const fireOwner = (view: PieceView): object =>
		finale && sameSquare(finale.square, view.square) ? finale.owner : view;
	// Input is blocked while the result window is up, but that window is a DOM layer: the
	// board and the final flame stay on screen. Only a hidden playfield extinguishes it.
	const fireBlocked = (): boolean => !visible || (isInputBlocked() && !finale);
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
	const take = (
		which: 'intro' | 'marks',
		texture: string,
		depth: number,
	): MarkerImage => {
		let img = pools[which][used[which]];
		if (!img) {
			img = scene.add.image(0, 0, texture);
			pools[which].push(img);
		}
		used[which] += 1;
		return img
			.setTexture(texture)
			.setName(texture)
			.setDepth(depth)
			.setVisible(true)
			.setAlpha(1)
			.setRotation(0);
	};
	const toneTexture = (
		tone: MarkTone,
		amber: string,
		copper: string,
	): string => (tone === 'copper' ? copper : amber);
	const placeStaple = (
		square: ISquare,
		alpha: number,
		depth: number,
		which: 'intro' | 'marks',
		texture = MARKER_STAPLES,
	): void => {
		if (alpha <= 0 || !hasTexture(texture)) return;
		const box = cellBox(square);
		take(which, texture, depth)
			.setPosition(box.x, box.y)
			.setOrigin(0.5, 0.5)
			.setDisplaySize(box.w, box.h)
			.setAlpha(alpha);
	};
	const placeArrow = (from: ISquare, to: ISquare, texture: string): void => {
		if (!hasTexture(texture)) return;
		const step = screenStep(from, to, facing);
		if (!step.dx || !step.dy) return;
		const box = cellBox(from);
		const long = Math.max(box.w, box.h) * ARROW_CELL;
		const scale = long / Math.max(ARROW_TEXTURE.w, ARROW_TEXTURE.h);
		take('marks', texture, 8.2)
			.setOrigin(0.5, 0.5)
			.setDisplaySize(ARROW_TEXTURE.w * scale, ARROW_TEXTURE.h * scale)
			.setRotation(arrowRotation(step.dx, step.dy))
			.setPosition(
				box.x + step.dx * box.w * ARROW_CORNER,
				box.y + step.dy * box.h * ARROW_CORNER,
			);
	};
	const placeCut = (square: ISquare, from: ISquare, to: ISquare): void => {
		if (!hasTexture(MARKER_CUT)) return;
		const step = screenStep(from, to, facing);
		if (!step.dx || !step.dy) return;
		const box = cellBox(square);
		take('marks', MARKER_CUT, 8.25)
			.setOrigin(0.5, 0.5)
			.setDisplaySize(box.w, box.h)
			.setRotation(cutRotation(step.dx, step.dy))
			.setPosition(box.x, box.y);
	};
	const drawIntro = () => {
		introMarks.clear();
		release('intro');
		if (!visible || moving || isInputBlocked()) return;
		for (const { square, alpha } of intro.sample(
			introProgress,
			introReduced,
			selected,
		))
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
		const routes = markerMoves(choices, selected);
		if (position) {
			const plan = planMoveMarks(position, routes);
			const taken = new Set(plan.victims.map(key));
			for (const cell of plan.brackets) {
				if (taken.has(key(cell.square))) continue;
				placeStaple(
					cell.square,
					1,
					8.05,
					'marks',
					toneTexture(cell.tone, MARKER_STAPLES_AMBER, MARKER_STAPLES_COPPER),
				);
			}
			for (const cut of plan.cuts) placeCut(cut.square, cut.from, cut.to);
			for (const arrow of plan.arrows)
				placeArrow(
					arrow.from,
					arrow.to,
					toneTexture(arrow.tone, MARKER_ARROW_AMBER, MARKER_ARROW_COPPER),
				);
		}
		if (selected) placeStaple(selected, 1, 8.15, 'marks', MARKER_STAPLES_AMBER);
		drawInteraction();
	};
	const hasTexture = (key: string): boolean =>
		typeof scene.textures.exists !== 'function' || scene.textures.exists(key);
	const pieceTexture = (
		kind: PieceView['kind'],
		side: PieceView['side'],
	): string =>
		kind === 'king'
			? side === 'white'
				? pieceSprites.kingLight
				: pieceSprites.kingDark
			: side === 'white'
				? pieceSprites.manLight
				: pieceSprites.manDark;
	const renderPiece = (view: PieceView): void => {
		const king = view.kind === 'king';
		const texture = pieceTexture(view.kind, view.side);
		view.sprite
			.setTexture(texture)
			.setName('selection-piece')
			.setData('square', { ...view.square })
			.setData('kind', view.kind)
			.setData('side', view.side)
			.setData('progress', view.motion.progress);
		view.outline.setTexture(texture);
		view.seal.setVisible(king && hasTexture('selection_king-seal'));
		for (const image of [view.sprite, view.outline])
			image
				.setOrigin(0.5, 0.5)
				.setPosition(0, 0)
				.setDisplaySize(field.cell * 0.86, field.cell * 0.86);
		view.outline.setVisible(false);
		view.seal
			.setPosition(0, 0)
			.setDisplaySize(field.cell, field.cell)
			.setData('temporaryRank', true);
		// Selection overlay: its own layer above the piece, cell-sized, normal alpha over.
		// Frames 0 and exit-03 carry no ink, so both endpoints simply hide the layer.
		const overlayFrame = selectionOverlayFrame(view.motion.progress, view.motion.opening);
		const overlayTexture = selectionOverlayTexture(overlayFrame);
		const overlayReady = overlayFrame !== 'none' && hasTexture(overlayTexture);
		if (overlayReady) view.overlay.setTexture(overlayTexture);
		view.overlay
			.setVisible(overlayReady)
			.setOrigin(0.5, 0.5)
			.setPosition(0, 0)
			.setDisplaySize(field.cell, field.cell)
			.setData('frame', overlayFrame)
			.setData('progress', view.motion.progress);
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
	const dropTexture = (textureKey: string): void => {
		if (typeof scene.textures.remove !== 'function') return;
		if (
			typeof scene.textures.exists === 'function' &&
			!scene.textures.exists(textureKey)
		)
			return;
		scene.textures.remove(textureKey);
	};
	const clearFalls = (): void => {
		for (const fall of falls) {
			scene.tweens.killTweensOf(fall.image);
			if (!(fall.image as { destroyed?: boolean }).destroyed)
				fall.image.destroy();
			if (fall.textureKey) {
				dropTexture(fall.textureKey);
				dropTexture(fall.textureKey.replace('capture-half-', 'capture-src-'));
			}
		}
		falls.length = 0;
	};
	const sourceImage = (textureKey: string): CanvasImageSource | null => {
		const texture = scene.textures.get(textureKey) as {
			getSourceImage?: () => CanvasImageSource;
		} | null;
		return texture?.getSourceImage?.() ?? null;
	};
	const showHalf = (
		textureKey: string,
		box: { x: number; y: number; w: number; h: number },
		endX: number,
		endY: number,
		spin: number,
		align = 0,
	): Phaser.GameObjects.Image => {
		const image = scene.add
			.image(box.x, box.y, textureKey)
			.setName('capture-half')
			.setDepth(6)
			.setOrigin(0.5, 0.5)
			.setDisplaySize(box.w * 0.86, box.h * 0.86)
			.setRotation(align);
		falls.push({ image, textureKey });
		scene.tweens.add({
			targets: image,
			x: endX,
			y: endY,
			rotation: align + spin,
			duration: 520,
			ease: 'Cubic.easeOut',
		});
		scene.tweens.add({
			targets: image,
			alpha: 0,
			delay: 320,
			duration: 280,
			onComplete: () => {
				if (!(image as { destroyed?: boolean }).destroyed) image.destroy();
				dropTexture(textureKey);
				dropTexture(textureKey.replace('capture-half-', 'capture-src-'));
			},
		});
		return image;
	};
	const paintPiece = (view: PieceView): HTMLCanvasElement | null => {
		if (
			typeof document === 'undefined' ||
			typeof document.createElement !== 'function'
		)
			return null;
		const disk = sourceImage(view.sprite.texture.key);
		if (!disk) return null;
		const size = 160;
		const painted = document.createElement('canvas');
		painted.width = size;
		painted.height = size;
		const ctx = painted.getContext('2d');
		if (!ctx) return null;
		const inset = size * 0.07;
		ctx.drawImage(disk, inset, inset, size - inset * 2, size - inset * 2);
		if (view.seal.visible) {
			const seal = sourceImage(view.seal.texture.key);
			if (seal) ctx.drawImage(seal, 0, 0, size, size);
		}
		return painted;
	};
	const spawnHalf = (
		pixels: Uint8ClampedArray,
		width: number,
		height: number,
		box: { x: number; y: number; w: number; h: number },
		endX: number,
		endY: number,
		spin: number,
	): void => {
		if (
			typeof scene.textures.addCanvas !== 'function' ||
			typeof document === 'undefined'
		)
			return;
		const source = document.createElement('canvas');
		source.width = width;
		source.height = height;
		const ctx = source.getContext('2d');
		if (!ctx) return;
		const imageData = ctx.createImageData
			? ctx.createImageData(width, height)
			: ({
					data: new Uint8ClampedArray(width * height * 4),
					width,
					height,
				} as ImageData);
		imageData.data.set(pixels);
		ctx.putImageData(imageData, 0, 0);
		const textureKey = `capture-src-${cutSerial}`;
		const showKey = `capture-half-${cutSerial}`;
		cutSerial += 1;
		const created = scene.textures as {
			createCanvas?: (
				key: string,
				w: number,
				h: number,
			) => {
				getContext: () => CanvasRenderingContext2D;
				refresh?: () => void;
			} | null;
			addDynamicTexture?: (
				key: string,
				w: number,
				h: number,
			) => {
				stamp: (
					key: string,
					frame: string | number | undefined,
					x: number,
					y: number,
				) => unknown;
				render?: () => void;
				setFilter?: (mode: number) => void;
			} | null;
		};
		const canvasTex = created.createCanvas?.(textureKey, width, height);
		if (!canvasTex) {
			if (typeof scene.textures.addCanvas !== 'function') return;
			scene.textures.addCanvas(textureKey, source);
			showHalf(textureKey, box, endX, endY, spin);
			return;
		}
		canvasTex.getContext().drawImage(source, 0, 0);
		canvasTex.refresh?.();
		const gpu = created.addDynamicTexture?.(showKey, width, height);
		if (!gpu) {
			showHalf(textureKey, box, endX, endY, spin);
			return;
		}
		gpu.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
		// WebGL ignores putImageData until a later frame, and DynamicTexture.render
		// during the game step blanks the camera. Stamp once the canvas is uploaded.
		const paint = (): void => {
			gpu.stamp(
				textureKey,
				null as unknown as undefined,
				width / 2,
				height / 2,
			);
			gpu.render?.();
			showHalf(showKey, box, endX, endY, spin);
		};
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => requestAnimationFrame(paint));
		} else {
			paint();
		}
	};
	/** Landed capture: mask the live texture into two halves. No new piece art. */
	const splitVictim = (view: PieceView, from: ISquare, land: ISquare): void => {
		const step = screenStep(from, land, facing);
		const box = cellBox(view.square);
		const painted = paintPiece(view);
		remove(view);
		if (!step.dx || !step.dy) return;
		const normal = splitNormal(step.dx, step.dy);
		const dist = box.w * 0.62;
		const drop = box.h * 0.9;
		const ends = [
			{
				x: box.x + normal.x * dist,
				y: box.y + normal.y * dist + drop,
				spin: 0.35,
				sign: 1,
			},
			{
				x: box.x - normal.x * dist,
				y: box.y - normal.y * dist + drop,
				spin: -0.35,
				sign: -1,
			},
		];
		if (painted) {
			const ctx = painted.getContext('2d');
			const data = ctx?.getImageData(0, 0, painted.width, painted.height);
			if (ctx && data) {
				const halves = splitPixels(
					data.data,
					painted.width,
					painted.height,
					step.dx,
					step.dy,
				);
				spawnHalf(
					halves.a,
					painted.width,
					painted.height,
					box,
					ends[0]!.x,
					ends[0]!.y,
					ends[0]!.spin,
				);
				spawnHalf(
					halves.b,
					painted.width,
					painted.height,
					box,
					ends[1]!.x,
					ends[1]!.y,
					ends[1]!.spin,
				);
			}
		}
		if (!hasTexture(MARKER_CUT)) return;
		const cut = scene.add
			.image(box.x, box.y, MARKER_CUT)
			.setName('capture-cut')
			.setDepth(6.4)
			.setOrigin(0.5, 0.5)
			.setDisplaySize(box.w * 0.92, box.h * 0.92)
			.setRotation(cutRotation(step.dx, step.dy));
		falls.push({ image: cut });
		scene.tweens.add({
			targets: cut,
			alpha: 0,
			duration: 240,
			delay: 220,
			onComplete: () => {
				if (!(cut as { destroyed?: boolean }).destroyed) cut.destroy();
			},
		});
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
				if (sundered.has(id)) {
					seen.add(id);
					return;
				}
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
					const sealKey = hasTexture('selection_king-seal')
						? 'selection_king-seal'
						: texture;
					const seal = scene.add
						.image(0, 0, sealKey)
						.setName('king-seal')
						.setVisible(false);
					// Overlay frame pack arrives lazily: until then keep a live texture
					// and stay hidden, so a missing key never reaches the renderer.
					const overlayKey = hasTexture(selectionOverlayTexture('none'))
						? selectionOverlayTexture('none')
						: texture;
					const overlay = scene.add
						.image(0, 0, overlayKey)
						.setName('selection-overlay')
						.setVisible(false);
					view = {
						square,
						kind: piece.kind,
						side: piece.side,
						motion: new SelectionMotion(),
						sprite,
						outline,
						seal,
						overlay,
						group: scene.add
							.container(0, 0, [outline, sprite, seal, overlay])
							.setDepth(4)
							.setName('selection-piece-group'),
					};
					pieces.set(id, view);
				}
				view.kind = piece.kind;
				view.side = piece.side;
				const open = Boolean(selected && sameSquare(selected, square));
				view.motion.select(open, reduced() || (open && view === landedView));
				view.group.setVisible(visible);
				place(view);
				kingFire.rest(
					fireOwner(view),
					visible && !fireBlocked() && view.kind === 'king',
					cellBox(square),
					field.cell,
					reduced(),
				);
			});
		});
		for (const id of [...sundered]) if (!seen.has(id)) sundered.delete(id);
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
		kingFire.clear(finale !== null);
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
		ensureBoardFrames(scene);
		const frameName = boardFrameName(facing);
		if (
			scene.textures?.exists?.(boardFrameSheet) &&
			scene.textures.get(boardFrameSheet).has(frameName)
		) {
			if (board.texture?.key !== boardFrameSheet) board.setTexture(boardFrameSheet, frameName);
			else board.setFrame(frameName);
		}
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
		if (!moving)
			for (const view of pieces.values()) {
				place(view);
				kingFire.rest(
					fireOwner(view),
					visible && !fireBlocked() && view.kind === 'king',
					cellBox(view.square),
					field.cell,
					reduced(),
				);
			}
		draw();
	};
	const reset = (options?: { keepPromotionFire?: boolean }): void => {
		// A promotion on the last move must be seen: hand its fire to the presentation instead
		// of destroying it. Anything else (a new match, a hidden playfield, undo) clears it.
		const promotion = lastPromotion;
		const keep =
			options?.keepPromotionFire === true &&
			promotion !== null &&
			promotion.view.kind === 'king' &&
			sameSquare(promotion.view.square, promotion.square) &&
			pieces.get(key(promotion.square)) === promotion.view
				? promotion
				: null;
		if (keep) {
			finale = { owner: keep.view, square: { ...keep.square } };
			kingFire.keep(keep.view);
		} else {
			finale = null;
		}
		lastPromotion = null;
		kingFire.clear(keep !== null);
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
		sundered.clear();
		clearFalls();

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
		// Only a promotion made by the move that ends the match may arm the finale.
		lastPromotion = null;
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
					view.motion.select(
						Boolean(selected && sameSquare(selected, view.square)),
						reduced(),
					);
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
			placeStaple(from, 1, 8, 'marks', MARKER_STAPLES_AMBER);
			placeArrow(from, land, victim ? MARKER_ARROW_COPPER : MARKER_ARROW_AMBER);
			placeStaple(
				land,
				1,
				8.05,
				'marks',
				victim ? MARKER_STAPLES_COPPER : MARKER_STAPLES_AMBER,
			);
			if (victim) placeCut(victim, from, land);
			kingFire.takeoff(
				view,
				view.kind === 'king',
				cellBox(from),
				field.cell,
				reduced(),
			);
			pieceStepSfx(
				view.kind === 'king',
				Boolean(victim),
				view.side,
				victim ? pieces.get(key(victim))?.side : undefined,
			);
			onTakeoff?.(Boolean(victim));
			const finish = (): void => {
				if (generation !== run) return;
				if (victim) {
					const taken = pieces.get(key(victim));
					if (taken && !reduced()) {
						pieces.delete(key(victim));
						sundered.add(key(victim));
						splitVictim(taken, from, land);
					} else if (taken && !retainCaptured) {
						remove(taken);
						pieces.delete(key(victim));
					}
				}
				kingFire.move(cellBox(land));
				kingFire.land();
				view.square = land;
				if (
					view.kind === 'man' &&
					land.row === (view.side === 'white' ? 7 : 0)
				) {
					view.kind = 'king';
					lastPromotion = { view, square: { ...land } };
					kingFire.ignite(view, cellBox(land), field.cell, reduced());
				}
				place(view);
				kingFire.rest(
					view,
					visible && view.kind === 'king',
					cellBox(land),
					field.cell,
					reduced(),
				);
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
				onUpdate: (
					_tween: Phaser.Tweens.Tween,
					_target: object,
					property: string,
				) => {
					if (generation === run && property === 'y')
						kingFire.move(view.group, scene.game.loop?.delta ?? 0);
				},
				onComplete: finish,
			});
		};
		step(0);
	};
	const updateHints = (_time: number, delta: number): void => {
		if (fireBlocked()) kingFire.clear();
		kingFire.update(delta, reduced());
		for (const view of pieces.values()) {
			if (!fireBlocked())
				kingFire.rest(
					fireOwner(view),
					view.kind === 'king',
					cellBox(view.square),
					field.cell,
					reduced(),
				);
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
		clearOpeningHint: () => {
			intro.clear();
			introMarks.clear();
			release('intro');
		},
		startOpeningHint: (position, local) => {
			intro.start(position, local);
			introProgress = 0;
			introReduced = reduced();
			drawIntro();
		},
		paintOpeningHint: (progress, motionReduced) => {
			introProgress = progress;
			introReduced = motionReduced;
			drawIntro();
		},
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
