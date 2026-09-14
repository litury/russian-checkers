import type Phaser from 'phaser';
import { revealPose } from './panelReveal';

export function preloadBunkerPanels(scene: Phaser.Scene) {
	const assets = import.meta.glob('./ui/bunker/*.png', {
		eager: true,
		query: '?url',
		import: 'default',
	});
	for (const [path, url] of Object.entries(assets)) {
		const name = path.split('/').pop()!.replace('.png', '');
		if (name === 'steam-sheet')
			scene.load.spritesheet('bunker-steam', url as string, {
				frameWidth: 72,
				frameHeight: 56,
			});
		else if (name !== 'opening-mask')
			scene.load.image(`bunker-${name}`, url as string);
	}
}
/** One reusable bay. All coordinates and pixels come from approved V2, not the movie.
 * Rectangular source crops implement the local [10,10,364,118) opening mask.
 * Unlike legacy GeometryMask these work in Phaser 4 WebGL without filtered FBOs.
 */
export function createBunkerPanel(scene: Phaser.Scene, own: boolean) {
	const root = scene.add.container(0, 0).setDepth(12);
	const image = (name: string, x = 0, y = 0) => {
		const go = scene.add.image(x, y, `bunker-${name}`).setOrigin(0);
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
	image('rear-niche');
	image('lift-rails');
	const shadow = image('panel-cast-shadow', 12, 124);
	const face = image(
		own ? 'panel-own-face-prepared' : 'panel-opponent-face',
		10,
		122,
	);
	const label = text(own ? 'ВАША СТОРОНА' : 'СОПЕРНИК', 39, 26, 11, '#bcb39e');
	const name = text(own ? 'Ты' : 'Бот', 39, 46, 21, '#eee4cf');
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
	image('lip-contact-shadow');
	image('thick-frame');
	image('front-lip');
	image('side-vents');
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
		disposed = false;
	type Croppable = Phaser.GameObjects.Image | Phaser.GameObjects.Text;
	function clip(go: Croppable, resolution = 1) {
		const x = Math.max(0, 10 - go.x),
			y = Math.max(0, 10 - go.y);
		const w = Math.max(0, Math.min(go.width - x, 364 - go.x - x)),
			h = Math.max(0, Math.min(go.height - y, 118 - go.y - y));
		go.setVisible(w > 0 && h > 0);
		go.setCrop(x * resolution, y * resolution, w * resolution, h * resolution);
	}
	function paint() {
		if (disposed) return;
		const p = revealPose(elapsed, reduced);
		face.setTexture(
			own
				? active && !preparing
					? 'bunker-panel-own-face-ready'
					: 'bunker-panel-own-face-prepared'
				: 'bunker-panel-opponent-face',
		);
		face.y = 10 + p.lift;
		clip(face);
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
		jets.forEach((go) => {
			go.setVisible(false); // Opening v4: no smoke, including the overlapping panel reveal.
		});
	}
	// Font arrival updates actual canvas text, but never reveals a hidden root or restarts motion.
	void document.fonts?.load('600 21px "Golos Text"').then(() => {
		if (disposed) return;
		movingText.forEach((go) => go.setFontFamily('"Golos Text", sans-serif'));
		paint();
	});
	scene.events.once('shutdown', () => {
		disposed = true;
	});
	return {
		root,
		layout(x: number, y: number, scale: number) {
			root.setPosition(x, y).setScale(scale);
		},
		pose(ms: number, reduce: boolean) {
			elapsed = ms;
			reduced = reduce;
			paint();
		},
		setName(value: string) {
			name.setText(value);
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
