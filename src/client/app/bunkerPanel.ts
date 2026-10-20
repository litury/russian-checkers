import type Phaser from 'phaser';
import { compactPanelHeight } from '../config/matchActions';
import {
	clockFrame,
	clockFramePose,
	clockFrameStep,
	clockFrameWanted,
} from './clockFrame';
import { revealPose } from './panelReveal';

import bunkerAtlasUrl from './ui/bunker/atlas.webp?url';
import bunkerAtlas from './ui/bunker/atlas.json';
import clockAtlasUrl from './ui/clock-frame/atlas.webp?url';
import clockAtlas from './ui/clock-frame/atlas.json';
import steamUrl from './ui/bunker/steam-sheet.webp?url';

export function preloadBunkerPanels(scene: Phaser.Scene) {
	// Metadata is bundled: each independently visible region needs one image request.
	scene.load.atlas('bunker-metal', bunkerAtlasUrl, bunkerAtlas);
	scene.load.atlas('clock-metal', clockAtlasUrl, clockAtlas);
	scene.load.spritesheet('bunker-steam', steamUrl, {
		frameWidth: 72,
		frameHeight: 56,
	});
}
/** One reusable bay. All coordinates and pixels come from approved V2, not the movie.
 * Rectangular source crops implement the local [10,10,364,118) opening mask.
 * Unlike legacy GeometryMask these work in Phaser 4 WebGL without filtered FBOs.
 */
export function createBunkerPanel(scene: Phaser.Scene, own: boolean) {
	const root = scene.add.container(0, 0).setDepth(12);
	const skins: Phaser.GameObjects.NineSlice[] = [];
	const skin = (frame: string) => {
		const go = scene.add
			.nineslice(0, 0, 'bunker-metal', frame, 374, 128, 24, 24, 24, 24)
			.setOrigin(0);
		root.add(go);
		skins.push(go);
	};
	const image = (name: string, x = 0, y = 0) => {
		const go = scene.add.image(x, y, 'bunker-metal', name).setOrigin(0);
		root.add(go);
		return go;
	};
	const text = (
		content: string,
		x: number,
		y: number,
		size: number,
		color: string,
	) => {
		const go = scene.add
			.text(x, y, content, {
				fontFamily: '"Golos Text", sans-serif',
				fontSize: `${size}px`,
				fontStyle: '600',
				color,
				resolution: 2,
			})
			.setOrigin(0);
		root.add(go);
		return go;
	};
	skin('rear-niche');
	skin('lift-rails');
	const shadow = image('panel-cast-shadow', 12, 124);
	const face = image(
		own ? 'panel-own-face-prepared' : 'panel-opponent-face',
		10,
		122,
	);
	const faceMiddle = image(
		own ? 'panel-own-face-prepared' : 'panel-opponent-face',
		10,
		122,
	);
	const faceRight = image(
		own ? 'panel-own-face-prepared' : 'panel-opponent-face',
		10,
		122,
	);
	const label = text(own ? '' : 'СОПЕРНИК', 39, 26, 11, '#bcb39e');
	const name = text(
		own ? '' : 'Бот',
		own ? 20 : 39,
		own ? 16 : 46,
		own ? 11 : 21,
		'#eee4cf',
	);
	// Separate digit cells preserve approved tabular advances in live Golos text.
	const digits = [0, 1, 2, 3, 4].map((i) =>
		text('0', 254 + [0, 17, 34, 42, 59][i], 39, 27, '#eee4cf'),
	);
	const status = own
		? text('Подготовка к партии', 57, 89, 14, '#c6b896')
		: undefined;
	const light = image('readiness-light', 10, 122);
	const left = image('door-left', 10, 10),
		right = image('door-right', 187, 10);
	skin('lip-contact-shadow');
	skin('thick-frame');
	skin('front-lip');
	skin('side-vents');
	// Non-overlapping source quarters: the approved pixels move rigidly, never scale.
	const frameParts = ['frame-c', 'frame-c-active', 'frame-c-lights'].flatMap(
		(key, layer) =>
			[
				[-1, -1],
				[1, -1],
				[-1, 1],
				[1, 1],
			].map(([sx, sy]) => {
				const go = scene.add
					.image(clockFrame.x, clockFrame.y, 'clock-metal', key)
					.setOrigin(0);
				const splitY = Math.floor(clockFrame.height / 2);
				go.setCrop(
					sx < 0 ? 0 : 70,
					sy < 0 ? 0 : splitY,
					70,
					sy < 0 ? splitY : clockFrame.height - splitY,
				);
				root.add(go);
				return { go, layer, sx, sy };
			}),
	);
	const jets = [4, 316].map((x, i) => {
		const go = scene.add
			.sprite(x, -8, 'bunker-steam', 0)
			.setOrigin(0)
			.setDisplaySize(54, 42)
			.setFlipX(i === 0)
			.setVisible(false);
		root.add(go);
		return go;
	});
	const movingText = [label, name, ...digits, ...(status ? [status] : [])];
	const textY = movingText.map((go) => go.y);
	let elapsed = 2800,
		reduced = false,
		active = false,
		preparing = false,
		disposed = false,
		compactPanel = false,
		panelScaleX = 1,
		panelScaleY = 1,
		clockScale = 1,
		clockX = clockFrame.x,
		clockY = clockFrame.y,
		faceY = 10,
		frameAmt = 0,
		sampledAt: number | null = null;
	type Croppable = Phaser.GameObjects.Image | Phaser.GameObjects.Text;
	function clip(
		go: Croppable,
		resolution = 1,
		sourceLeft = 0,
		sourceRight = go.width,
	) {
		const scaleX = go.scaleX || 1,
			scaleY = go.scaleY || 1;
		const x = Math.max(sourceLeft, (10 - go.x) / scaleX),
			y = Math.max(0, (10 - go.y) / scaleY);
		const w = Math.max(0, Math.min(sourceRight - x, (364 - go.x) / scaleX - x)),
			h = Math.max(0, Math.min(go.height - y, (118 - go.y) / scaleY - y));
		go.setVisible(w > 0 && h > 0);
		go.setCrop(x * resolution, y * resolution, w * resolution, h * resolution);
	}
	function paint() {
		if (disposed) return;
		const p = revealPose(elapsed, reduced);
		const faceTexture = own
			? active && !preparing
				? 'panel-own-face-ready'
				: 'panel-own-face-prepared'
			: 'panel-opponent-face';
		for (const section of [face, faceMiddle, faceRight]) {
			section.setTexture('bunker-metal', faceTexture);
			section.y = faceY + p.lift;
		}
		clip(face, 1, 0, 70);
		clip(faceMiddle, 1, 70, 213);
		clip(faceRight, 1, 213, 354);
		shadow.setPosition(
			12 + Math.round(3 * (1 - p.lift / 112)),
			10 + p.lift + Math.round(2 + (7 * p.lift) / 112),
		);
		clip(shadow);
		movingText.forEach((go, i) => {
			go.y = textY[i] + p.lift;
			clip(go, 2);
		});
		light.y = 10 + p.lift;
		light.setAlpha(own ? p.light : 0);
		clip(light);
		left.x = 10 - p.doors;
		right.x = 187 + p.doors;
		clip(left);
		clip(right);
		const open = clockFrameWanted(p.doors, p.lift, active, preparing);
		const y = clockY + p.lift;
		const a = clockFramePose(frameAmt, open, reduced);
		const alphas = [a.metal, a.amber, a.lights];
		for (const { go, layer, sx, sy } of frameParts) {
			const alpha = alphas[layer];
			go.setPosition(
				clockX + (sx * a.spreadX * clockScale) / panelScaleX,
				y + (sy * a.spreadY * clockScale) / panelScaleY,
			);
			go.setScale(clockScale / panelScaleX, clockScale / panelScaleY);
			go.setAlpha(alpha).setVisible(
				!compactPanel && alpha > 0 && p.lift <= 0 && p.doors >= 181,
			);
		}
		jets.forEach((go) => {
			go.setVisible(false); // Opening v4: no smoke, including the overlapping panel reveal.
		});
	}
	const tickFrame = () => {
		if (disposed) return;
		const now = scene.time.now;
		const dt = sampledAt === null ? 0 : now - sampledAt;
		sampledAt = now;
		const p = revealPose(elapsed, reduced);
		const want = clockFrameWanted(p.doors, p.lift, active, preparing);
		frameAmt = clockFrameStep(frameAmt, want, dt, reduced);
		paint();
	};
	// Font arrival updates actual canvas text, but never reveals a hidden root or restarts motion.
	void document.fonts?.load('600 21px "Golos Text"')
		.then(() => {
			if (disposed) return;
			movingText.forEach((go) => go.setFontFamily('"Golos Text", sans-serif'));
			paint();
		})
		.catch(() => {
			/* Keep the existing system-font canvas; font failure is nonfatal. */
		});
	scene.events.on('update', tickFrame);
	scene.events.once('shutdown', () => {
		disposed = true;
		scene.events.off('update', tickFrame);
	});
	return {
		root,
		isEntranceReady() {
			const p = revealPose(elapsed, reduced);
			return (
				!preparing &&
				p.lift === 0 &&
				p.doors === 181 &&
				(!clockFrameWanted(p.doors, p.lift, active, preparing) || frameAmt >= 1)
			);
		},
		layout(x: number, y: number, scale: number, scaleY = scale) {
			root.setPosition(x, y).setScale(scale, scaleY);
			panelScaleX = scale;
			panelScaleY = scaleY;
			const contentScale = Math.min(1, scale, scaleY);
			clockScale = contentScale;
			skins.forEach((go) => {
				go.setSize((374 * scale) / contentScale, (128 * scaleY) / contentScale);
				go.setScale(contentScale / scale, contentScale / scaleY);
			});
			const compact = 128 * scaleY < compactPanelHeight;
			compactPanel = compact;
			const textScale = compact ? 0.7 : contentScale;
			const rightScale = Math.max(contentScale, textScale);
			const middleWidth = 354 * scale - 70 * contentScale - 141 * rightScale;
			const middleScale = middleWidth / 143;
			faceY = 64 - (54 * contentScale) / scaleY;
			face.setScale(contentScale / scale, contentScale / scaleY);
			faceMiddle.x = 10 + (70 * contentScale - 70 * middleScale) / scale;
			faceMiddle.setScale(middleScale / scale, contentScale / scaleY);
			faceRight.x = 364 - (354 * rightScale) / scale;
			faceRight.setScale(rightScale / scale, contentScale / scaleY);
			clockX = 364 - (141 * rightScale) / scale;
			clockY = faceY + (4 * contentScale) / scaleY;
			digits.forEach((digit, index) => {
				digit.x =
					clockX + ((31 + [0, 17, 34, 42, 59][index]) * textScale) / scale;
				textY[index + 2] = compact
					? 17 / scaleY
					: clockY + (25 * textScale) / scaleY;
				digit.setScale(textScale / scale, textScale / scaleY);
			});
			if (own) {
				name.x = compact ? clockX + (31 * textScale) / scale : 20;
				textY[1] = compact ? 6 / scaleY : 16;
				name.setScale(textScale / scale, textScale / scaleY);
				if (status) {
					status.x = compact ? clockX + (6 * textScale) / scale : 57;
					textY[textY.length - 1] = compact
						? (128 * scaleY - 23) / scaleY
						: scaleY < 0.9
							? 93
							: 89;
					const statusScale = compact ? 0.65 : contentScale;
					status.setScale(statusScale / scale, statusScale / scaleY);
				}
			} else {
				textY[0] = compact ? 8 / scaleY : 26;
				textY[1] = compact ? 23 / scaleY : 46;
				label.setScale(textScale / scale, textScale / scaleY);
				name.setScale(textScale / scale, textScale / scaleY);
			}
			paint();
		},
		pose(ms: number, reduce: boolean) {
			elapsed = ms;
			reduced = reduce;
			paint();
		},
		setName(value: string) {
			name.setText(own ? '' : value);
			while (name.width > 187 && Array.from(name.text).length > 2)
				name.setText(Array.from(name.text).slice(0, -2).join('') + '…');
			paint();
		},
		setClock(value: string, isActive: boolean, isPreparing: boolean) {
			digits.forEach((go, i) => go.setText(value[i] ?? '0'));
			active = isActive;
			preparing = isPreparing;
			paint();
		},
		setStatus(value: string) {
			status?.setText(value);
			paint();
		},
	};
}
