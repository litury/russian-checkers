import Phaser from 'phaser';
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
const titleSize = 28;
const pressNudge = 2;
export const replayPulseScale = 1.03;
export const replayPulseMs = 800;
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

function stackHeight(): number {
	return titleSize + gap + monH + gap + btnH;
}

function zoomFor(width: number, height: number): number {
	if (height > width) {
		return 1;
	}
	if (height >= stackHeight() * 1.5 + 24) {
		return 1.5;
	}
	return 1;
}

export function createResultOverlay(
	scene: Phaser.Scene,
	onPlayAgain: () => void,
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
			fontFamily: 'Arial, sans-serif',
			fontSize: `${titleSize}px`,
			color: palette.text,
		})
		.setOrigin(0.5, 1)
		.setStroke('#1a1410', 2);

	const glass = scene.add.image(0, 0, 'resultGlassWin').setOrigin(0, 0);
	const monitor = scene.add.image(0, 0, 'resultMonitor').setOrigin(0, 0);
	const hero = scene.add.image(0, 0, winKeys[0]).setOrigin(0.5, 1);
	const btn = scene.add.image(0, 0, 'resultBtn').setOrigin(0.5);
	const label = scene.add
		.text(0, 0, 'Ещё раз', {
			fontFamily: 'Arial, sans-serif',
			fontSize: '22px',
			color: palette.text,
		})
		.setOrigin(0.5)
		.setStroke('#1a1410', 2);
	const btnWrap = scene.add.container(0, 0);
	btnWrap.add([btn, label]);
	const hit = scene.add.rectangle(0, 0, hitW, hitH, 0x000000, 0);
	hit.setOrigin(0, 0);
	hit.setInteractive({ useHandCursor: true });

	root.add([title, glass, monitor, hero, btnWrap, hit]);

	let cheer: Phaser.Time.TimerEvent | undefined;
	let loseAnim: Phaser.Time.TimerEvent | undefined;
	let pulse: Phaser.Tweens.Tween | undefined;
	let cheerFrame = 0;
	let loseFrame = 0;
	let btnY = 0;
	let pressed = false;

	function restBtn(): void {
		btnWrap.setY(btnY + btnH / 2);
		pressed = false;
	}

	function stopPulse(): void {
		pulse?.stop();
		pulse = undefined;
		btnWrap.setScale(1);
	}

	function startPulse(): void {
		stopPulse();
		pulse = scene.tweens.add({
			targets: btnWrap,
			scaleX: replayPulseScale,
			scaleY: replayPulseScale,
			duration: replayPulseMs,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut',
		});
	}

	hit.on('pointerdown', () => {
		stopPulse();
		pressed = true;
		btnWrap.setY(btnY + btnH / 2 + pressNudge);
	});
	hit.on('pointerup', () => {
		if (!pressed) {
			return;
		}
		restBtn();
		onPlayAgain();
	});
	hit.on('pointerout', () => {
		if (pressed) {
			restBtn();
		}
	});

	function place(width: number, height: number): void {
		dim.setPosition(width / 2, height / 2);
		dim.setDisplaySize(width, height);
		const zoom = zoomFor(width, height);
		root.setScale(zoom);
		const stackH = stackHeight();
		root.setPosition(
			Math.round((width - monW * zoom) / 2),
			Math.round((height - stackH * zoom) / 2),
		);
		title.setPosition(monW / 2, titleSize);
		const monX = 0;
		const monY = titleSize + gap;
		monitor.setPosition(monX, monY);
		glass.setPosition(monX + glassX, monY + glassY);
		hero.setPosition(
			monX + glassX + glassW / 2,
			monY + glassY + glassH - floorPad,
		);
		hero.setDisplaySize(heroFit, heroFit);
		btnY = monY + monH + gap;
		btnWrap.setPosition(monX + (monW - btnW) / 2 + btnW / 2, btnY + btnH / 2);
		btn.setPosition(0, 0);
		label.setPosition(0, 0);
		hit.setPosition(monX + (monW - hitW) / 2, btnY - (hitH - btnH) / 2);
		hit.setSize(hitW, hitH);
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
			restBtn();
			dim.setVisible(false);
			root.setVisible(false);
		},
	};
}
