import Phaser from 'phaser';
import { palette } from '@/client/config/palette';

const monW = 256;
const monH = 192;
const glassX = 16;
const glassY = 12;
const glassW = 224;
const glassH = 168;
const btnW = 224;
const btnH = 48;
const hitW = 224;
const hitH = 64;
const heroFit = 120;
const floorPad = 2;
const chassisGap = 12;
const btnGap = 8;
const titleSize = 32;
const pressNudge = 2;
const onlineAlpha = 0.45;
const depth = 18;

export const titleRowMinWidth = 460;
export const titleCopy = 'Русские шашки';
export const titleBotCopy = 'Играть';
export const titleOnlineCopy = 'Онлайн';
export const titleColor = '#F4EFE4';
export const titleStroke = '#1A1410';
export const titleHeroFit = heroFit;
export const idleKeys = [
	'mascotIdle0',
	'mascotIdle1',
	'mascotIdle2',
	'mascotIdle3',
] as const;
/** Y bob per idle frame: 00/02 rest, 01 −1px, 03 +1px. */
export const idleBobY = [0, -1, 0, 1] as const;
export const idleMs = 180;

function isRow(width: number): boolean {
	return width >= titleRowMinWidth;
}

function stackSize(row: boolean): { w: number; h: number } {
	return {
		w: row ? btnW * 2 + btnGap : monW,
		h:
			titleSize +
			chassisGap +
			monH +
			chassisGap +
			btnH +
			(row ? 0 : btnGap + btnH),
	};
}

function fitContain(image: Phaser.GameObjects.Image, box: number): void {
	const frame = image.frame as { width?: number; height?: number } | undefined;
	const w = frame?.width || box;
	const h = frame?.height || box;
	const scale = box / Math.max(w, h, 1);
	image.setDisplaySize(Math.round(w * scale), Math.round(h * scale));
}

export function createTitleOverlay(
	scene: Phaser.Scene,
	handlers: { onPlayBot: () => void },
): {
	layout: (width: number, height: number) => void;
	show: () => void;
	hide: () => void;
} {
	for (const key of [
		'resultMonitor',
		'resultGlassMeadow',
		'resultBtn',
		'mascotIdle',
		...idleKeys,
	]) {
		if (!scene.textures.exists(key)) {
			continue;
		}
		scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
	}

	const catcher = scene.add.rectangle(0, 0, 16, 16, 0x000000, 0);
	catcher.setDepth(depth);
	catcher.setVisible(false);

	const root = scene.add.container(0, 0);
	root.setDepth(depth + 1);
	root.setVisible(false);

	const title = scene.add
		.text(0, 0, titleCopy, {
			fontFamily: 'Arial, sans-serif',
			fontSize: `${titleSize}px`,
			color: titleColor,
		})
		.setOrigin(0.5, 1)
		.setStroke(titleStroke, 2);

	const glass = scene.add.image(0, 0, 'resultGlassMeadow').setOrigin(0, 0);
	const monitor = scene.add.image(0, 0, 'resultMonitor').setOrigin(0, 0);
	const hero = scene.add.image(0, 0, idleKeys[0]).setOrigin(0.5, 1);

	const botBtn = scene.add.image(0, 0, 'resultBtn').setOrigin(0.5);
	const botLabel = scene.add
		.text(0, 0, titleBotCopy, {
			fontFamily: 'Arial, sans-serif',
			fontSize: '22px',
			color: palette.text,
		})
		.setOrigin(0.5)
		.setStroke(titleStroke, 2);
	const botWrap = scene.add.container(0, 0);
	botWrap.add([botBtn, botLabel]);
	const botHit = scene.add.rectangle(0, 0, hitW, hitH, 0x000000, 0);
	botHit.setOrigin(0, 0);

	const onlineBtn = scene.add.image(0, 0, 'resultBtn').setOrigin(0.5);
	const onlineLabel = scene.add
		.text(0, 0, titleOnlineCopy, {
			fontFamily: 'Arial, sans-serif',
			fontSize: '22px',
			color: palette.text,
		})
		.setOrigin(0.5)
		.setStroke(titleStroke, 2);
	const onlineWrap = scene.add.container(0, 0);
	onlineWrap.add([onlineBtn, onlineLabel]);
	onlineWrap.setAlpha(onlineAlpha);

	root.add([title, glass, monitor, hero, botWrap, botHit, onlineWrap]);

	let botY = 0;
	let heroBaseY = 0;
	let pressed = false;
	let shown = false;
	let idleFrame = 0;
	let idleTimer: Phaser.Time.TimerEvent | undefined;

	function paintIdle(): void {
		hero.setTexture(idleKeys[idleFrame]);
		fitContain(hero, heroFit);
		hero.setY(heroBaseY + idleBobY[idleFrame]);
	}

	function stopIdle(): void {
		idleTimer?.remove(false);
		idleTimer = undefined;
	}

	function startIdle(): void {
		stopIdle();
		idleFrame = 0;
		paintIdle();
		idleTimer = scene.time.addEvent({
			delay: idleMs,
			loop: true,
			callback: () => {
				idleFrame = (idleFrame + 1) % idleKeys.length;
				paintIdle();
			},
		});
	}

	function restBot(): void {
		botWrap.setY(botY + btnH / 2);
		pressed = false;
	}

	botHit.on('pointerdown', () => {
		if (!shown) {
			return;
		}
		pressed = true;
		botWrap.setY(botY + btnH / 2 + pressNudge);
	});
	botHit.on('pointerup', () => {
		if (!pressed) {
			return;
		}
		restBot();
		handlers.onPlayBot();
	});
	botHit.on('pointerout', () => {
		if (pressed) {
			restBot();
		}
	});

	function place(width: number, height: number): void {
		catcher.setPosition(width / 2, height / 2);
		catcher.setDisplaySize(width, height);
		const row = isRow(width);
		const stack = stackSize(row);
		root.setPosition(
			Math.round((width - stack.w) / 2),
			Math.round((height - stack.h) / 2),
		);
		title.setPosition(stack.w / 2, titleSize);
		const monX = Math.round((stack.w - monW) / 2);
		const monY = titleSize + chassisGap;
		monitor.setPosition(monX, monY);
		glass.setPosition(monX + glassX, monY + glassY);
		heroBaseY = monY + glassY + glassH - floorPad;
		hero.setPosition(monX + glassX + glassW / 2, heroBaseY);
		paintIdle();
		const btnTop = monY + monH + chassisGap;
		if (row) {
			const botX = btnW / 2;
			const onlineX = btnW + btnGap + btnW / 2;
			botY = btnTop;
			botWrap.setPosition(botX, botY + btnH / 2);
			botHit.setPosition(botX - hitW / 2, botY - (hitH - btnH) / 2);
			onlineWrap.setPosition(onlineX, btnTop + btnH / 2);
		} else {
			const cx = stack.w / 2;
			botY = btnTop;
			botWrap.setPosition(cx, botY + btnH / 2);
			botHit.setPosition(cx - hitW / 2, botY - (hitH - btnH) / 2);
			onlineWrap.setPosition(cx, btnTop + btnH + btnGap + btnH / 2);
		}
		botBtn.setPosition(0, 0);
		botLabel.setPosition(0, 0);
		onlineBtn.setPosition(0, 0);
		onlineLabel.setPosition(0, 0);
		botHit.setSize(hitW, hitH);
		restBot();
	}

	return {
		layout: (width, height) => {
			place(width, height);
		},
		show: () => {
			shown = true;
			place(scene.scale.width, scene.scale.height);
			startIdle();
			catcher.setVisible(true);
			catcher.setInteractive();
			botHit.setInteractive({ useHandCursor: true });
			root.setVisible(true);
		},
		hide: () => {
			shown = false;
			pressed = false;
			stopIdle();
			catcher.setVisible(false);
			catcher.disableInteractive();
			botHit.disableInteractive();
			root.setVisible(false);
		},
	};
}
