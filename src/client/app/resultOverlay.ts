import Phaser from 'phaser';
import { hudFont } from '@/client/fonts/fonts';
import { palette } from '@/client/config/palette';
import type { Side } from '@/rules';

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
const gap = 12;
const btnGap = 8;
const titleSize = 28;
const pressNudge = 2;
const rowMin = 460;
export const replayPulseScale = 1.03;
export const replayPulseMs = 800;
export const resultAgainCopy = 'Ещё раз';
export const resultMenuCopy = 'В меню';
export const winKeys = [
	'mascotWin0',
	'mascotWin1',
	'mascotWin2',
	'mascotWin3',
	'mascotWin4',
] as const;
export const cheerMs = 120;
export const loseKeys = [
	'mascotLose0',
	'mascotLose1',
	'mascotLose2',
	'mascotLose3',
	'mascotLose4',
	'mascotLose5',
] as const;
export const loseHolds = [200, 320, 280, 240, 180] as const;
const depth = 20;

function isRow(width: number): boolean {
	return width >= rowMin;
}

function stackSize(row: boolean): { w: number; h: number } {
	return {
		w: row ? btnW * 2 + btnGap : monW,
		h: titleSize + gap + monH + gap + btnH + (row ? 0 : btnGap + btnH),
	};
}

function zoomFor(width: number, height: number, row: boolean): number {
	if (height > width) {
		return 1;
	}
	if (height >= stackSize(row).h * 1.5 + 24) {
		return 1.5;
	}
	return 1;
}

export function createResultOverlay(
	scene: Phaser.Scene,
	handlers: {
		onPlayAgain: () => void;
		onMenu: () => void;
	},
): {
	layout: (width: number, height: number) => void;
	show: (side: Side) => void;
	hide: () => void;
} {
	for (const key of [
		'resultMonitor',
		'resultGlassWin',
		'resultGlassLose',
		'resultBtn',
		...loseKeys,
		...winKeys,
	]) {
		if (!scene.textures.exists(key)) {
			continue;
		}
		scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
	}

	const dim = scene.add.rectangle(0, 0, 16, 16, palette.overlay, 0.4);
	dim.setDepth(depth);
	dim.setVisible(false);

	const root = scene.add.container(0, 0);
	root.setDepth(depth + 1);
	root.setVisible(false);

	const title = scene.add
		.text(0, 0, '', {
			fontFamily: hudFont,
			fontSize: `${titleSize}px`,
			color: palette.text,
		})
		.setOrigin(0.5, 1)
		.setStroke('#1a1410', 2);

	const glass = scene.add.image(0, 0, 'resultGlassWin').setOrigin(0, 0);
	const monitor = scene.add.image(0, 0, 'resultMonitor').setOrigin(0, 0);
	const hero = scene.add.image(0, 0, winKeys[0]).setOrigin(0.5, 1);

	const againBtn = scene.add.image(0, 0, 'resultBtn').setOrigin(0.5);
	const againLabel = scene.add
		.text(0, 0, resultAgainCopy, {
			fontFamily: hudFont,
			fontSize: '22px',
			color: palette.text,
		})
		.setOrigin(0.5)
		.setStroke('#1a1410', 2);
	const againWrap = scene.add.container(0, 0);
	againWrap.add([againBtn, againLabel]);
	const againHit = scene.add.rectangle(0, 0, hitW, hitH, 0x000000, 0);
	againHit.setOrigin(0, 0);
	againHit.setInteractive({ useHandCursor: true });

	const menuBtn = scene.add.image(0, 0, 'resultBtn').setOrigin(0.5);
	const menuLabel = scene.add
		.text(0, 0, resultMenuCopy, {
			fontFamily: hudFont,
			fontSize: '22px',
			color: palette.text,
		})
		.setOrigin(0.5)
		.setStroke('#1a1410', 2);
	const menuWrap = scene.add.container(0, 0);
	menuWrap.add([menuBtn, menuLabel]);
	const menuHit = scene.add.rectangle(0, 0, hitW, hitH, 0x000000, 0);
	menuHit.setOrigin(0, 0);
	menuHit.setInteractive({ useHandCursor: true });

	root.add([
		title,
		glass,
		monitor,
		hero,
		againWrap,
		againHit,
		menuWrap,
		menuHit,
	]);

	let cheer: Phaser.Time.TimerEvent | undefined;
	let loseAnim: Phaser.Time.TimerEvent | undefined;
	let pulse: Phaser.Tweens.Tween | undefined;
	let cheerFrame = 0;
	let loseFrame = 0;
	let againY = 0;
	let menuY = 0;
	let againPressed = false;
	let menuPressed = false;

	function restAgain(): void {
		againWrap.setY(againY + btnH / 2);
		againPressed = false;
	}

	function restMenu(): void {
		menuWrap.setY(menuY + btnH / 2);
		menuPressed = false;
	}

	function stopPulse(): void {
		pulse?.stop();
		pulse = undefined;
		againWrap.setScale(1);
	}

	function startPulse(): void {
		stopPulse();
		pulse = scene.tweens.add({
			targets: againWrap,
			scaleX: replayPulseScale,
			scaleY: replayPulseScale,
			duration: replayPulseMs,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut',
		});
	}

	againHit.on('pointerdown', () => {
		stopPulse();
		againPressed = true;
		againWrap.setY(againY + btnH / 2 + pressNudge);
	});
	againHit.on('pointerup', () => {
		if (!againPressed) {
			return;
		}
		restAgain();
		handlers.onPlayAgain();
	});
	againHit.on('pointerout', () => {
		if (againPressed) {
			restAgain();
		}
	});

	menuHit.on('pointerdown', () => {
		menuPressed = true;
		menuWrap.setY(menuY + btnH / 2 + pressNudge);
	});
	menuHit.on('pointerup', () => {
		if (!menuPressed) {
			return;
		}
		restMenu();
		handlers.onMenu();
	});
	menuHit.on('pointerout', () => {
		if (menuPressed) {
			restMenu();
		}
	});

	function place(width: number, height: number): void {
		dim.setPosition(width / 2, height / 2);
		dim.setDisplaySize(width, height);
		const row = isRow(width);
		const zoom = zoomFor(width, height, row);
		const stack = stackSize(row);
		root.setScale(zoom);
		root.setPosition(
			Math.round((width - stack.w * zoom) / 2),
			Math.round((height - stack.h * zoom) / 2),
		);
		title.setPosition(stack.w / 2, titleSize);
		const monX = Math.round((stack.w - monW) / 2);
		const monY = titleSize + gap;
		monitor.setPosition(monX, monY);
		glass.setPosition(monX + glassX, monY + glassY);
		hero.setPosition(
			monX + glassX + glassW / 2,
			monY + glassY + glassH - floorPad,
		);
		hero.setDisplaySize(heroFit, heroFit);
		const btnTop = monY + monH + gap;
		if (row) {
			const againX = btnW / 2;
			const menuX = btnW + btnGap + btnW / 2;
			againY = btnTop;
			menuY = btnTop;
			againWrap.setPosition(againX, againY + btnH / 2);
			againHit.setPosition(againX - hitW / 2, againY - (hitH - btnH) / 2);
			menuWrap.setPosition(menuX, menuY + btnH / 2);
			menuHit.setPosition(menuX - hitW / 2, menuY - (hitH - btnH) / 2);
		} else {
			const cx = stack.w / 2;
			againY = btnTop;
			menuY = btnTop + btnH + btnGap;
			againWrap.setPosition(cx, againY + btnH / 2);
			againHit.setPosition(cx - hitW / 2, againY - (hitH - btnH) / 2);
			menuWrap.setPosition(cx, menuY + btnH / 2);
			menuHit.setPosition(cx - hitW / 2, menuY - (hitH - btnH) / 2);
		}
		againBtn.setPosition(0, 0);
		againLabel.setPosition(0, 0);
		menuBtn.setPosition(0, 0);
		menuLabel.setPosition(0, 0);
		againHit.setSize(hitW, hitH);
		menuHit.setSize(hitW, hitH);
	}

	function stopLose(): void {
		loseAnim?.remove(false);
		loseAnim = undefined;
	}

	function stopCheer(): void {
		cheer?.remove(false);
		cheer = undefined;
		stopLose();
	}

	function startCheer(): void {
		stopCheer();
		cheerFrame = 0;
		hero.setTexture(winKeys[0]);
		cheer = scene.time.addEvent({
			delay: cheerMs,
			loop: true,
			callback: () => {
				cheerFrame = (cheerFrame + 1) % winKeys.length;
				hero.setTexture(winKeys[cheerFrame]);
			},
		});
	}

	function startLose(): void {
		stopCheer();
		loseFrame = 0;
		hero.setTexture(loseKeys[0]);
		const step = (): void => {
			if (loseFrame >= loseKeys.length - 1) {
				return;
			}
			loseAnim = scene.time.delayedCall(loseHolds[loseFrame], () => {
				loseFrame += 1;
				hero.setTexture(loseKeys[loseFrame]);
				step();
			});
		};
		step();
	}

	return {
		layout: (width, height) => {
			place(width, height);
		},
		show: (side) => {
			const won = side === 'white';
			title.setText(won ? 'Вы выиграли' : 'Вы проиграли');
			glass.setTexture(won ? 'resultGlassWin' : 'resultGlassLose');
			place(scene.scale.width, scene.scale.height);
			if (won) {
				startCheer();
			} else {
				startLose();
			}
			hero.setDisplaySize(heroFit, heroFit);
			startPulse();
			dim.setVisible(true);
			root.setVisible(true);
		},
		hide: () => {
			stopCheer();
			stopPulse();
			restAgain();
			restMenu();
			dim.setVisible(false);
			root.setVisible(false);
		},
	};
}
