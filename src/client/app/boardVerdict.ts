import type Phaser from 'phaser';
import type { Side } from '@/rules';
import './boardVerdict.css';
import { readSafeInsets } from '@/client/config/matchLayout';
import { prepareResignArt, resignArtReady } from './matchActionArtWarmup';
import { uiSfx } from './uiSfx';
import { verdictControlsGeometry } from './verdictControlsGeometry';

export type Verdict = {
	winner: Side | 'draw';
	humanSide: Side;
	reason: string;
	online: boolean;
};

/** Ready with the scene bundle: no loader, decode, API or sound gate. */
export function createResultOverlay(
	scene: Phaser.Scene,
	handlers: {
		onPlayAgain: () => void;
		onMenu: () => void;
	},
) {
	const root = document.createElement('dialog');
	root.className = 'board-verdict';
	root.tabIndex = -1;
	root.hidden = true;
	root.innerHTML =
		'<section class="verdict-panel" role="dialog" aria-modal="true" aria-labelledby="verdict-heading" aria-describedby="verdict-reason" tabindex="-1"><div class="verdict-title"><div class="verdict-upper"><p class="verdict-eyebrow">ПАРТИЯ ЗАВЕРШЕНА</p><h1 id="verdict-heading"></h1></div><p id="verdict-reason"></p></div><div class="verdict-actions"><button type="button" data-verdict="again">Ещё партия</button><button type="button" data-verdict="board">Посмотреть доску</button><button type="button" data-verdict="menu">В меню</button></div></section><div class="verdict-status" hidden><button type="button" data-verdict="open"></button><button type="button" data-verdict="menu">В меню</button></div>';
	document.body.append(root);
	const panel = root.querySelector<HTMLElement>('.verdict-panel')!;
	const status = root.querySelector<HTMLElement>('.verdict-status')!;
	const boardButton = panel.querySelector<HTMLButtonElement>('[data-verdict="board"]')!;
	boardButton.textContent = 'К доске';
	boardButton.setAttribute('aria-label', 'Посмотреть доску');
	const heading = root.querySelector<HTMLElement>('#verdict-heading')!;
	const reason = root.querySelector<HTMLElement>('#verdict-reason')!;
	const again = root.querySelector<HTMLButtonElement>(
		'[data-verdict="again"]',
	)!;
	const reopen = root.querySelector<HTMLButtonElement>(
		'[data-verdict="open"]',
	)!;
	const inert = new Map<HTMLElement, boolean>();
	let previous: HTMLElement | null = null;
	let shown = false;
	let disposed = false;
	let frame = 0;
	let entering = false;
	function covered() {
		entering = false;
		panel.inert = false;
		document.dispatchEvent(new Event('damka:loss-covered'));
		if (shown && !panel.hidden) panel.focus({ preventScroll: true });
	}

	function release() {
		for (const [element, value] of inert) element.inert = value;
		inert.clear();
	}
	function open(animate = false) {
		if (!animate) uiSfx('ui-open');
		panel.hidden = false;
		root.classList.add('expanded');
		status.hidden = true;
		panel.classList.toggle('enter', animate);
		if (root.dataset.outcome === 'loss') {
			entering = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches;
			panel.inert = entering;
			if (!root.open) root.showModal();
			if (!entering) covered();
		} else {
			// Authority may report a different outcome while resignation is pending.
			covered();
		}
		for (const child of Array.from(document.body.children)) {
			if (!(child instanceof HTMLElement) || child === root) continue;
			inert.set(child, child.inert);
			child.inert = true;
		}
		if (!entering) panel.focus({ preventScroll: true });
	}
	function collapse() {
		if (entering) return;
		if (root.open) root.close();
		uiSfx('ui-close');
		panel.hidden = true;
		root.classList.remove('expanded');
		panel.classList.remove('enter');
		status.hidden = false;
		release();
		reopen.focus({ preventScroll: root.dataset.controlsLayout !== 'dock' });
	}
	function hide(_force = false) {
		covered();
		if (root.open) root.close();
		shown = false;
		cancelAnimationFrame(frame);
		root.hidden = true;
		panel.classList.remove('enter');
		release();
		if (
			root.contains(document.activeElement) &&
			previous?.isConnected &&
			!previous.inert
		)
			previous.focus({ preventScroll: true });
		previous = null;
	}
	function click(event: MouseEvent) {
		const button = (event.target as Element).closest<HTMLButtonElement>(
			'button[data-verdict]',
		);
		if (shown && event.target === root && !panel.hidden) {
			collapse();
			return;
		}
		if (!shown || !button || entering) return;
		switch (button.dataset.verdict) {
			case 'board':
				collapse();
				break;
			case 'open':
				open();
				break;
			case 'again':
				hide();
				handlers.onPlayAgain();
				uiSfx('ui-tap');
				break;
			case 'menu':
				hide();
				handlers.onMenu();
				uiSfx('ui-close');
				break;
		}
	}
	function keydown(event: KeyboardEvent) {
		if (!shown) return;
		if (entering) { event.preventDefault(); event.stopPropagation(); return; }
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			if (panel.hidden) open();
			else collapse();
		}
		if (event.key === 'Tab' && !panel.hidden) {
			const buttons = Array.from(
				panel.querySelectorAll<HTMLButtonElement>('button'),
			);
			const index = buttons.indexOf(
				document.activeElement as HTMLButtonElement,
			);
			event.preventDefault();
			const next =
				index < 0
					? event.shiftKey
						? buttons.length - 1
						: 0
					: (index + (event.shiftKey ? -1 : 1) + buttons.length) %
						buttons.length;
			buttons[next].focus();
		}
	}
	root.addEventListener('click', click);
	root.addEventListener('cancel', event => { event.preventDefault(); if (!entering) collapse(); });
	panel.addEventListener('animationend', event => {
		if (entering && event.target === panel) covered();
	});
	panel.addEventListener('animationcancel', event => {
		if (entering && event.target === panel) {
			panel.classList.remove('enter');
			covered();
		}
	});
	document.addEventListener('keydown', keydown, true);
	scene.events.once('shutdown', () => {
		disposed = true;
		hide();
		root.removeEventListener('click', click);
		document.removeEventListener('keydown', keydown, true);
		root.remove();
	});
	return {
		layout(width: number, height: number) {
			const geometry = verdictControlsGeometry(width, height, readSafeInsets());
			root.dataset.controlsLayout = geometry.dock ? 'dock' : 'pocket';
			// DOM targets stay 44 CSS px; never scale their text with the canvas.
			status.style.left = `${geometry.left}px`;
			status.style.top = `${geometry.top}px`;
			status.style.gridTemplateColumns = `${geometry.primaryWidth}px 64px`;
			if (shown && !status.hidden) {
				if (geometry.dock) window.scrollTo(0, document.documentElement.scrollHeight);
				else window.scrollTo(0, 0);
			}
		},
		hide,
		show(verdict: Verdict) {
			if (disposed || shown) return;
			shown = true;
			previous = document.activeElement as HTMLElement | null;
			const state =
				verdict.winner === 'draw'
					? 'draw'
					: verdict.winner === verdict.humanSide
						? 'win'
						: 'loss';
			root.dataset.outcome = state;
			if (state === 'loss') {
				root.dataset.artReady = String(resignArtReady());
				if (!resignArtReady()) void prepareResignArt().then(ready => {
					if (!disposed) root.dataset.artReady = String(ready);
				});
			}
			heading.textContent =
				state === 'win' ? 'ПОБЕДА' : state === 'loss' ? 'ПОРАЖЕНИЕ' : 'НИЧЬЯ';
			reason.textContent = verdict.reason;
			again.textContent = verdict.online ? 'Найти соперника' : 'Ещё партия';
			reopen.textContent = 'Итог партии';
			reopen.setAttribute('aria-label', `Итог партии: ${heading.textContent.toLowerCase()}`);
			root.hidden = false;
			open(true);
			performance.mark('damka:result-actions-ready');
			// rAF is a DOM render opportunity, not proof of painted pixels. Browser
			// screenshots/filmstrip remain the visual evidence for this mark.
			frame = requestAnimationFrame(() => {
				if (shown) performance.mark('damka:result-render-opportunity');
			});
		},
	};
}
