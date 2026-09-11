import Phaser from 'phaser';
import { hudFont, whenHudFontReady } from '@/client/fonts/fonts';
import { palette } from '@/client/config/palette';
import type { Side } from '@/rules';
import { defeatTerminalLayout } from './defeatTerminalLayout';
import { createDefeatControls } from './defeatControls';
import { defeatButtonState } from './defeatButtonState';

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
export const idleKeys = [
	'mascotIdle0',
	'mascotIdle1',
	'mascotIdle2',
	'mascotIdle3',
] as const;
export const idleMs = 280;
export const loseKeys: Record<Side, string[]> = {
 white: Array.from({ length: 9 }, (_, i) => `checkerDefeat_white_0${i}`),
 black: Array.from({ length: 9 }, (_, i) => `checkerDefeat_black_0${i}`),
};
export const loseHolds = [350, 160, 140, 120, 120, 150, 180, 250, 1200] as const;
export const resultCatcherDepth = 20;
const depth = resultCatcherDepth;

function prefersReducedMotion(): boolean {
	try {
		return Boolean(
			globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
		);
	} catch {
		return false;
	}
}

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
	show: (winner: Side, humanSide: Side) => void;
	hide: () => void;
} {
	for (const key of [
		'resultMonitor',
		'defeatTerminal',
		'defeat_primary_rest', 'defeat_primary_pressed', 'defeat_secondary_rest', 'defeat_secondary_pressed',
		'resultGlassWin',
		'resultGlassLose',
		'resultBtn',
		...loseKeys.white,
		...loseKeys.black,
		...winKeys,
		...idleKeys,
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
	const terminal = scene.add.image(0, 0, 'defeatTerminal').setOrigin(0, 0).setVisible(false);
	const faces = [0,1].map(i => scene.add.image(0,0,defeatButtonState(i,false).key).setOrigin(0,0).setVisible(false));
	const eyebrow = scene.add.text(162,59,'РЕЗУЛЬТАТ ПАРТИИ',{fontFamily:hudFont,fontSize:'10px',color:'#A1B5A6'}).setOrigin(0.5,0).setVisible(false);

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
		terminal,
		...faces,
		eyebrow,
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
	let idleAnim: Phaser.Time.TimerEvent | undefined;
	let pulse: Phaser.Tweens.Tween | undefined;
	let cheerFrame = 0;
	let loseFrame = 0;
	let idleFrame = 0;
	let againY = 0;
	let menuY = 0;
	let againPressed = false;
	let menuPressed = false;
	let defeat = false;
	let shown = false;
	let transition: Phaser.Tweens.Tween | undefined;
	whenHudFontReady(() => { eyebrow.setFontFamily(hudFont); eyebrow.updateText(); });
	const controls = createDefeatControls(scene, [handlers.onPlayAgain, handlers.onMenu], (index, down) => {
		if (!defeat) return;
		const state = defeatButtonState(index,down);
		faces[index].setTexture(state.key);
		(index === 0 ? againLabel : menuLabel).setY(state.textY);
	});
	const heroSize = () => defeat ? 128 : heroFit;

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
		if (prefersReducedMotion()) {
			return;
		}
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
		if (defeat) {
			const l = defeatTerminalLayout(width,height);
			root.setScale(l.scale).setPosition(l.x,l.y);
			title.setOrigin(0.5,0).setPosition(162,85).setFontSize(22).setColor('#F4EFE4').setStroke('#F4EFE4',0);
			hero.setOrigin(0,0).setPosition(98,168).setDisplaySize(128,128);
			againWrap.setPosition(162,333).setScale(1);
			menuWrap.setPosition(148,373);
			againLabel.setOrigin(0.5,0).setPosition(0,0).setFontSize(20).setColor('#F4EFE4').setStroke('#F4EFE4',0).setText('ЕЩЁ РАЗ');
			menuLabel.setOrigin(0.5,0).setPosition(0,0).setFontSize(16).setColor('#C9D3C4').setStroke('#C9D3C4',0).setText('В МЕНЮ');
			controls.layout();
			return;
		}
		title.setOrigin(0.5,1).setFontSize(titleSize).setColor(palette.text).setStroke('#1a1410',2);
		hero.setOrigin(0.5,1);
		againLabel.setOrigin(0.5).setFontSize(22).setColor(palette.text).setStroke('#1a1410',2).setText(resultAgainCopy);
		menuLabel.setOrigin(0.5).setFontSize(22).setColor(palette.text).setStroke('#1a1410',2).setText(resultMenuCopy);
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
		hero.setDisplaySize(heroSize(), heroSize());
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

	function stopIdle(): void {
		idleAnim?.remove(false);
		idleAnim = undefined;
	}

	function startIdle(): void {
		stopIdle();
		idleFrame = 0;
		hero.setTexture(idleKeys[0]);
		hero.setDisplaySize(heroSize(), heroSize());
		if (prefersReducedMotion()) {
			return;
		}
		idleAnim = scene.time.addEvent({
			delay: idleMs,
			loop: true,
			callback: () => {
				idleFrame = (idleFrame + 1) % idleKeys.length;
				hero.setTexture(idleKeys[idleFrame]);
				hero.setDisplaySize(heroSize(), heroSize());
			},
		});
	}

	function stopLose(): void {
		loseAnim?.remove(false);
		loseAnim = undefined;
	}

	function stopCheer(): void {
		cheer?.remove(false);
		cheer = undefined;
		stopLose();
		stopIdle();
	}

	function startCheer(): void {
		stopCheer();
		cheerFrame = 0;
		hero.setTexture(winKeys[0]);
		if (prefersReducedMotion()) {
			startIdle();
			return;
		}
		cheer = scene.time.addEvent({
			delay: cheerMs,
			loop: true,
			callback: () => {
				if (cheerFrame >= winKeys.length - 1) {
					cheer?.remove(false);
					cheer = undefined;
					startIdle();
					return;
				}
				cheerFrame += 1;
				hero.setTexture(winKeys[cheerFrame]);
				hero.setDisplaySize(heroSize(), heroSize());
			},
		});
	}

	function startLose(humanSide: Side): void {
		stopCheer();
		const keys = loseKeys[humanSide];
		loseFrame = 0;
		hero.setTexture(keys[0]);
		if (prefersReducedMotion()) {
			hero.setTexture(keys[8]);
			return;
		}
		const step = (): void => {
			if (loseFrame >= keys.length - 1) {
				loseAnim = undefined;
				return;
			}
			loseAnim = scene.time.delayedCall(loseHolds[loseFrame], () => {
				loseFrame += 1;
				hero.setTexture(keys[loseFrame]);
				hero.setDisplaySize(heroSize(), heroSize());
				step();
			});
		};
		step();
	}

	return {
		layout: (width, height) => {
			place(width, height);
		},
		show: (side, humanSide) => {
			transition?.stop(); transition = undefined;
			shown = true;
			root.setAlpha(1);
			const won = side === humanSide;
			controls.hide();
			defeat = !won;
			// Countdown text is depth 40; defeat is a modal above the entire game.
			dim.setDepth(defeat ? 50 : depth);
			root.setDepth(defeat ? 51 : depth + 1);
			terminal.setVisible(defeat); eyebrow.setVisible(defeat);
			faces.forEach((face,i) => face.setVisible(defeat).setTexture(defeatButtonState(i,false).key));
			monitor.setVisible(won); glass.setVisible(won);
			againBtn.setVisible(won); menuBtn.setVisible(won);
			againHit.setVisible(won); menuHit.setVisible(won);
			if (won) { againHit.setInteractive({useHandCursor:true}); menuHit.setInteractive({useHandCursor:true}); }
			else { againHit.disableInteractive(); menuHit.disableInteractive(); }
			title.setText(won ? 'Вы выиграли' : 'ВЫ ПРОИГРАЛИ');
			glass.setTexture(won ? 'resultGlassWin' : 'resultGlassLose');
			place(scene.scale.width, scene.scale.height);
			if (won) {
				startCheer();
			} else {
				startLose(humanSide);
			}
			hero.setDisplaySize(heroSize(), heroSize());
			if (won) startPulse(); else { stopPulse(); controls.show(); }
			dim.setVisible(true);
			dim.setInteractive();
			root.setVisible(true);
			if (defeat && !prefersReducedMotion()) {
				root.setAlpha(0);
				transition = scene.tweens.add({targets:root,alpha:1,duration:180,ease:'Sine.easeOut'});
			}
		},
		hide: () => {
			const animateExit = shown && defeat && !prefersReducedMotion();
			shown = false;
			transition?.stop(); transition = undefined;
			controls.hide();
			stopCheer();
			stopPulse();
			if (!defeat) { restAgain(); restMenu(); }
			dim.setVisible(false);
			dim.disableInteractive();
			if (animateExit) {
				// Input and actions are released immediately, not after the fade.
				transition = scene.tweens.add({targets:root,alpha:0,duration:120,ease:'Sine.easeIn',onComplete:()=>{root.setVisible(false);}});
			} else { root.setVisible(false); root.setAlpha(1); }
		},
	};
}
