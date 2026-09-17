import type Phaser from 'phaser';
import type { Side } from '@/rules';
import { matchLayout, readSafeInsets } from '@/client/config/matchLayout';
import { createBunkerPanel } from './bunkerPanel';
import { PanelReveal, preparationMs } from './panelReveal';
import { panelDurationMs } from './openingGates';

export function clipPlayerName(raw: string): string {
	const chars = Array.from(raw.trim());
	return chars.length <= 12
		? chars.join('')
		: chars.slice(0, 11).join('') + '…';
}
export function panelClock(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
export function matchStatus(
	preparing: boolean,
	phase: string,
	capture: boolean,
	continuing: boolean,
): string {
	if (preparing) return 'Подготовка к партии';
	if (phase === 'bot') return 'Ход соперника';
	if (phase === 'over') return 'Партия завершена';
	if (phase !== 'human') return '';
	return continuing ? 'Продолжайте взятие' : capture ? 'Нужно бить' : 'Ваш ход';
}
export function createHud(
	scene: Phaser.Scene,
	handlers: { onAutoChange?: () => void; isPaused?: () => boolean; onRevealProgress?: (elapsed: number, reduced: boolean) => void } = {},
) {
	const foe = createBunkerPanel(scene, false),
		you = createBunkerPanel(scene, true);
	const reveal = new PanelReveal();
	const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
	let reduced = media?.matches ?? false,
		staticRun = reduced,
		visible = false;
	let sampledAt: number | null = null;
	let facing: Side = 'white';
	const visibilityChange = () => {
		sampledAt = null;
	};
	const paint = () => {
		foe.pose(reveal.elapsed, staticRun);
		you.pose(reveal.elapsed, staticRun);
		handlers.onRevealProgress?.(reveal.elapsed, staticRun);
	};
	const motionChange = () => {
		reduced = media?.matches ?? false;
		if (reduced) staticRun = true;
		paint();
	};
	const update = () => {
		const now = scene.time.now,
			delta = sampledAt === null ? 0 : now - sampledAt;
		sampledAt = now;
		if (!visible || !reveal.active || document.hidden || handlers.isPaused?.())
			return;
		// Same time domain as match banks, not Phaser's FPS-smoothed animation delta.
		reveal.advance(reduced ? preparationMs : delta * preparationMs / panelDurationMs);
		paint();
	};
	const autoChanged = (event: Event) => {
		if ((event as CustomEvent).detail?.autoMove !== undefined)
			handlers.onAutoChange?.();
	};
	media?.addEventListener('change', motionChange);
	window.addEventListener('checkers-settings-change', autoChanged);
	document.addEventListener('visibilitychange', visibilityChange);
	scene.events.on('update', update);
	scene.events.once('shutdown', () => {
		reveal.cancel();
		scene.events.off('update', update);
		media?.removeEventListener('change', motionChange);
		window.removeEventListener('checkers-settings-change', autoChanged);
		document.removeEventListener('visibilitychange', visibilityChange);
	});
	return {
		isMenuOpen: () => false,
		layout(width: number, height: number) {
			const l = matchLayout(width, height, readSafeInsets());
			foe.layout(l.foe.x, l.foe.y, l.panelScale);
			you.layout(l.you.x, l.you.y, l.panelScale);
		},
		setTurn(copy: string) {
			you.setStatus(copy);
		},
		setFacing(side: Side) {
			facing = side;
		},
		setClock(whiteSec: number, blackSec: number, turn: Side | null = 'white') {
			const own = facing === 'black' ? blackSec : whiteSec;
			const other = facing === 'black' ? whiteSec : blackSec;
			you.setClock(panelClock(own), turn === facing, reveal.active);
			foe.setClock(panelClock(other), turn !== null && turn !== facing, reveal.active);
		},
		setVisible(on: boolean) {
			visible = on;
			foe.root.setVisible(on);
			you.root.setVisible(on);
			if (!on) reveal.cancel();
		},
		setNames(own: string, other: string) {
			you.setName(clipPlayerName(own) || 'Ты');
			foe.setName(clipPlayerName(other) || 'Бот');
		},
		prepareClosed() {
			reveal.cancel();
			reveal.elapsed = 0;
			staticRun = false;
			sampledAt = null;
			paint();
		},
		startReveal(done: () => void) {
			staticRun = reduced;
			sampledAt = scene.time.now;
			reveal.start(() => {
				paint();
				done();
			});
			paint();
		},
		stopReveal() {
			reveal.cancel();
		},
	};
}
