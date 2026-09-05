import Phaser from 'phaser';
import { hudFont } from '@/client/fonts/fonts';

const btnW = 224;
const btnH = 48;
const hitW = 224;
const hitH = 64;
const btnGap = 8;
const titleGap = 20;
const pressNudge = 2;
const onlineAlpha = 0.45;
const depth = 18;
const bg916W = 216;
const bg916H = 384;
const bg169W = 384;
const bg169H = 216;

export const titleRowMinWidth = 460;
export const titleCopy = 'Русские шашки';
export const titleWordmarkKey = 'titleWordmark';
export const titleWordmarkW = 320;
export const titleWordmarkH = 128;
export const titleBotCopy = 'Играть';
export const titleOnlineCopy = 'Онлайн';
export const titleColor = '#F4EFE4';
export const titleStroke = '#1A1410';
export const titlePlateW = btnW;
export const titlePlateH = btnH;
export const titleBtnFill = '#7A4A28';
export const titleBtnStroke = '#1A1410';
export const titleBtnHighlight = '#C4B08A';
export const titleBtnBase = '#2A1C14';
export const titlePressNudge = pressNudge;
export const titleOnlineAlpha = onlineAlpha;
export const titlePortraitMinRatio = 1.2;
export const titleBgPortrait = 'titleBg916';
export const titleBgLandscape = 'titleBg169';

export function pickTitleBgKey(width: number, height: number): string {
	return height / width >= titlePortraitMinRatio ? titleBgPortrait : titleBgLandscape;
}

export function coverScale(
	viewW: number,
	viewH: number,
	texW: number,
	texH: number,
): number {
	return Math.max(viewW / texW, viewH / texH);
}

function isRow(width: number): boolean {
	return width >= titleRowMinWidth;
}

export function wordmarkScale(stackW: number): number {
	return Math.min(1, stackW / titleWordmarkW);
}

function stackSize(row: boolean): { w: number; h: number } {
	const w = row ? btnW * 2 + btnGap : btnW;
	const markH = titleWordmarkH * wordmarkScale(w);
	return {
		w,
		h: markH + titleGap + btnH + (row ? 0 : btnGap + btnH),
	};
}

function hex(s: string): number {
	return Number.parseInt(s.slice(1), 16);
}

function drawPlate(g: Phaser.GameObjects.Graphics): void {
	const x = -btnW / 2;
	const y = -btnH / 2;
	g.clear();
	g.fillStyle(hex(titleBtnFill), 1);
	g.fillRect(x, y, btnW, btnH);
	g.fillStyle(hex(titleBtnBase), 1);
	g.fillRect(x, y + btnH - 6, btnW, 6);
	g.fillStyle(hex(titleBtnHighlight), 1);
	g.fillRect(x + 2, y + 2, btnW - 4, 3);
	g.lineStyle(2, hex(titleBtnStroke), 1);
	g.strokeRect(x + 1, y + 1, btnW - 2, btnH - 2);
}

export function createTitleOverlay(
	scene: Phaser.Scene,
	handlers: { onPlayBot: () => void },
): {
	layout: (width: number, height: number) => void;
	show: () => void;
	hide: () => void;
} {
	const bg = scene.add.image(0, 0, titleBgPortrait).setOrigin(0.5);
	bg.setDepth(depth - 1);
	bg.setVisible(false);
	if (scene.textures.exists(titleBgPortrait)) {
		scene.textures.get(titleBgPortrait).setFilter(Phaser.Textures.FilterMode.NEAREST);
	}
	if (scene.textures.exists(titleBgLandscape)) {
		scene.textures.get(titleBgLandscape).setFilter(Phaser.Textures.FilterMode.NEAREST);
	}
	if (scene.textures.exists(titleWordmarkKey)) {
		scene.textures.get(titleWordmarkKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
	}

	const catcher = scene.add.rectangle(0, 0, 16, 16, 0x000000, 0);
	catcher.setDepth(depth);
	catcher.setVisible(false);

	const root = scene.add.container(0, 0);
	root.setDepth(depth + 1);
	root.setVisible(false);

	const title = scene.add.image(0, 0, titleWordmarkKey).setOrigin(0.5);
	if (scene.textures.exists(titleWordmarkKey)) {
		scene.textures.get(titleWordmarkKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
	}

	const botBtn = scene.add.graphics();
	drawPlate(botBtn);
	const botLabel = scene.add
		.text(0, 0, titleBotCopy, {
			fontFamily: hudFont,
			fontSize: '22px',
			color: titleColor,
		})
		.setOrigin(0.5)
		.setStroke(titleStroke, 2);
	const botWrap = scene.add.container(0, 0);
	botWrap.add([botBtn, botLabel]);
	const botHit = scene.add.rectangle(0, 0, hitW, hitH, 0x000000, 0);
	botHit.setOrigin(0, 0);

	const onlineBtn = scene.add.graphics();
	drawPlate(onlineBtn);
	const onlineLabel = scene.add
		.text(0, 0, titleOnlineCopy, {
			fontFamily: hudFont,
			fontSize: '22px',
			color: titleColor,
		})
		.setOrigin(0.5)
		.setStroke(titleStroke, 2);
	const onlineWrap = scene.add.container(0, 0);
	onlineWrap.add([onlineBtn, onlineLabel]);
	onlineWrap.setAlpha(onlineAlpha);

	root.add([title, botWrap, botHit, onlineWrap]);

	let botY = 0;
	let pressed = false;
	let shown = false;

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

	function layoutBg(width: number, height: number): void {
		const key = pickTitleBgKey(width, height);
		if (scene.textures.exists(key)) {
			bg.setTexture(key);
		}
		const texW = key === titleBgPortrait ? bg916W : bg169W;
		const texH = key === titleBgPortrait ? bg916H : bg169H;
		const s = coverScale(width, height, texW, texH);
		bg.setPosition(width / 2, height / 2);
		bg.setDisplaySize(texW * s, texH * s);
	}

	function place(width: number, height: number): void {
		layoutBg(width, height);
		catcher.setPosition(width / 2, height / 2);
		catcher.setDisplaySize(width, height);
		const row = isRow(width);
		const stack = stackSize(row);
		root.setPosition(
			Math.round((width - stack.w) / 2),
			Math.round((height - stack.h) / 2),
		);
		const s = wordmarkScale(stack.w);
		title.setDisplaySize(titleWordmarkW * s, titleWordmarkH * s);
		title.setPosition(stack.w / 2, (titleWordmarkH * s) / 2);
		const btnTop = titleWordmarkH * s + titleGap;
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
			bg.setVisible(true);
			catcher.setVisible(true);
			catcher.setInteractive();
			botHit.setInteractive({ useHandCursor: true });
			root.setVisible(true);
		},
		hide: () => {
			shown = false;
			pressed = false;
			bg.setVisible(false);
			catcher.setVisible(false);
			catcher.disableInteractive();
			botHit.disableInteractive();
			root.setVisible(false);
		},
	};
}
