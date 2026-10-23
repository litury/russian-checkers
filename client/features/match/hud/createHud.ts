import type Phaser from 'phaser';
import {
	matchLayout,
	readSafeInsets,
} from '@/client/features/match/hud/matchLayout';
import { playerPanelLayout } from '@/client/features/match/hud/playerPanelLayout';
import type { Side } from '@/shared/rules';
import {
	PanelReveal,
	panelDurationMs,
} from '../../../platform/browser/panelReveal';
import { matchActionGeometry } from '../actions/matchActionGeometry';
import type { PanelState } from './panelState';
import { createPlayerPanel } from './playerPanel';

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
export function createHud(
	scene: Phaser.Scene,
	handlers: {
		onAutoChange?: () => void;
		isPaused?: () => boolean;
		onRevealProgress?: (elapsed: number, reduced: boolean) => void;
	} = {},
) {
	const foe = createPlayerPanel(scene, false),
		you = createPlayerPanel(scene, true);
	const reveal = new PanelReveal();
	const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
	let reduced = media?.matches ?? false,
		staticRun = reduced,
		visible = false;
	let sampledAt: number | null = null;
	let facing: Side = 'white';
	const announcement = document.createElement('p');
	announcement.id = 'match-hud-status';
	announcement.className = 'match-hud-announcement';
	announcement.setAttribute('role', 'status');
	announcement.setAttribute('aria-live', 'polite');
	announcement.setAttribute('aria-atomic', 'true');
	announcement.hidden = true;
	document.body.append(announcement);
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
		reveal.advance(reduced ? panelDurationMs : delta);
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
		announcement.remove();
		reveal.cancel();
		scene.events.off('update', update);
		media?.removeEventListener('change', motionChange);
		window.removeEventListener('checkers-settings-change', autoChanged);
		document.removeEventListener('visibilitychange', visibilityChange);
	});
	return {
		isActionsReady: () => visible,
		isMenuOpen: () => false,
		layout(width: number, height: number) {
			const safe = readSafeInsets();
			const l = matchLayout(width, height, safe);
			const ownPanel = playerPanelLayout(l, width, height, safe);
			const foePanel = playerPanelLayout(l, width, height, safe, 'foe');
			foe.layout(foePanel.x, foePanel.y, foePanel.scaleX, foePanel.scaleY);
			you.layout(ownPanel.x, ownPanel.y, ownPanel.scaleX, ownPanel.scaleY);
			// Read the transform actually applied to Phaser, never a viewport-bottom guess.
			const actions = document.getElementById('match-actions');
			if (actions) {
				const box = matchActionGeometry(you.root);
				const canvas = scene.game.canvas.getBoundingClientRect();
				actions.dataset.tooltipBelow = String(box.tooltipBelow);
				actions.style.left = `${canvas.left + box.left}px`;
				actions.style.top = `${canvas.top + box.top}px`;
				actions.style.width = `${box.width}px`;
			}
		},
		setState(state: PanelState) {
			you.setState(state);
			foe.setState(state);
			const copy =
				state.kind === 'disconnected'
					? 'Соперник отключился. Ожидаем возвращения.'
					: [state.title, state.detail].filter(Boolean).join('. ');
			if (announcement.textContent !== copy) announcement.textContent = copy;
		},
		setFacing(side: Side) {
			facing = side;
			foe.setSide(side === 'white' ? 'black' : 'white');
			scene.game.canvas.setAttribute(
				'aria-description',
				`Ваша сторона: ${side === 'white' ? 'белые' : 'чёрные'}. Ваши шашки внизу доски.`,
			);
		},
		setClock(whiteSec: number, blackSec: number, turn: Side | null = 'white') {
			const own = facing === 'black' ? blackSec : whiteSec;
			const other = facing === 'black' ? whiteSec : blackSec;
			you.setClock(panelClock(own), turn === facing, turn === null);
			foe.setClock(
				panelClock(other),
				turn !== null && turn !== facing,
				turn === null,
			);
		},
		setVisible(on: boolean) {
			visible = on;
			announcement.hidden = !on;
			foe.root.setVisible(on);
			you.root.setVisible(on);
			if (!on) reveal.cancel();
		},
		setOpponent(name: string, description: string) {
			foe.setIdentity(clipPlayerName(name) || 'Соперник', description);
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
			// Normal motion is advanced by scene updates, never completed at start.
			if (reduced) reveal.advance(panelDurationMs);
			paint();
		},
		finishReveal() {
			// Authoritative online begin/resume cannot wait behind decoration.
			reveal.cancel();
			reveal.elapsed = panelDurationMs;
			staticRun = reduced;
			paint();
		},
		stopReveal() {
			reveal.cancel();
		},
	};
}
