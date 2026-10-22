import type Phaser from 'phaser';
import { requiredElement } from '@/client/platform/browser/dom';
import type { Side } from '@/shared/rules';
import { uiSfx } from '../../../audio/uiSfx';
import { decorateMenu } from '../../menu/menuAtlas';
import { readSafeInsets } from '../hud/matchLayout';
import { verdictControlsGeometry } from './verdictControlsGeometry';
import './boardVerdict.css';

export type Verdict = {
	winner: Side | 'draw';
	humanSide: Side;
	reason: string;
	online: boolean;
};

export function createResultOverlay(
	scene: Phaser.Scene,
	handlers: {
		onPlayAgain: () => void;
		onMenu: () => void;
	},
) {
	const root = document.createElement('div');
	root.className = 'board-verdict';
	root.hidden = true;
	root.innerHTML = `
		<dialog class="verdict-dialog" aria-labelledby="verdict-heading" aria-describedby="verdict-reason">
			<section class="verdict-panel">
				<div class="menu-choice-surface verdict-body">
					<div class="verdict-content">
						<h2 id="verdict-heading" tabindex="-1"></h2>
						<p id="verdict-reason"></p>
						<div class="verdict-actions">
							<button type="button" class="metal-button primary" data-verdict="again"><span class="verdict-again-label">Ещё партия</span></button>
							<button type="button" class="metal-button secondary" data-verdict="board">Посмотреть доску</button>
						</div>
					</div>
				</div>
				<footer class="menu-score-surface verdict-footer">
					<button type="button" class="play-back" data-verdict="menu">← В меню</button>
				</footer>
			</section>
		</dialog>
		<div class="verdict-status" role="group" aria-label="Действия после партии" hidden>
			<button type="button" class="menu-chip" data-verdict="open">Результат</button>
			<button type="button" class="menu-chip" data-verdict="menu">В меню</button>
		</div>`;
	document.body.append(root);
	decorateMenu(root);
	const control = <ElementType extends HTMLElement>(
		selector: string,
	): ElementType => {
		const element = root.querySelector<ElementType>(selector);
		if (!element) throw new Error(`Missing result control: ${selector}`);
		return element;
	};
	const dialog = control<HTMLDialogElement>('.verdict-dialog');
	const status = control<HTMLElement>('.verdict-status');
	const againLabel = control<HTMLElement>('.verdict-again-label');
	const reopen = control<HTMLButtonElement>('[data-verdict="open"]');
	const heading = requiredElement('verdict-heading');
	const reason = requiredElement('verdict-reason');
	let previous: HTMLElement | null = null;
	let shown = false;
	let disposed = false;
	let frame = 0;

	function open(sound = true) {
		if (!shown || dialog.open) return;
		root.classList.add('expanded');
		status.hidden = true;
		dialog.scrollTop = 0;
		const content = root.querySelector<HTMLElement>('.verdict-content');
		if (content) content.scrollTop = 0;
		dialog.showModal();
		document.dispatchEvent(new Event('damka:result-covered'));
		heading.focus({ preventScroll: true });
		if (sound) uiSfx('ui-open');
	}

	function collapse() {
		if (!shown || !dialog.open) return;
		root.classList.remove('expanded');
		dialog.close();
		status.hidden = false;
		reopen.focus({ preventScroll: true });
		uiSfx('ui-close');
	}

	function hide(_force = false) {
		const restoreFocus = root.contains(document.activeElement);
		shown = false;
		cancelAnimationFrame(frame);
		root.classList.remove('expanded');
		status.hidden = true;
		if (dialog.open) dialog.close();
		root.hidden = true;
		if (
			restoreFocus &&
			previous?.isConnected &&
			!previous.closest('[inert], [hidden]')
		)
			previous.focus({ preventScroll: true });
		previous = null;
	}

	const click = (event: MouseEvent) => {
		if (!shown || !(event.target instanceof Element)) return;
		const button = event.target.closest<HTMLButtonElement>(
			'button[data-verdict]',
		);
		if (event.target === dialog && !button) {
			collapse();
			return;
		}
		if (!button || button.disabled) return;
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
	};
	const keydown = (event: KeyboardEvent) => {
		if (
			shown &&
			!dialog.open &&
			event.key === 'Escape' &&
			!document.querySelector('dialog[open]')
		) {
			event.preventDefault();
			open();
		}
	};
	root.addEventListener('click', click);
	dialog.addEventListener('cancel', (event) => {
		event.preventDefault();
		collapse();
	});
	dialog.addEventListener('keydown', (event) => {
		if (event.key !== 'Tab') return;
		const buttons = [
			...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
		];
		if (!buttons.length) return;
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			index < 0
				? event.shiftKey
					? buttons.length - 1
					: 0
				: (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
		event.preventDefault();
		buttons[next].focus();
	});
	document.addEventListener('keydown', keydown);
	scene.events.once('shutdown', () => {
		disposed = true;
		hide();
		document.removeEventListener('keydown', keydown);
		root.remove();
	});
	return {
		layout(width: number, height: number) {
			const geometry = verdictControlsGeometry(width, height, readSafeInsets());
			status.style.left = `${geometry.left}px`;
			status.style.top = `${geometry.top}px`;
			status.style.width = `${geometry.width}px`;
		},
		hide,
		show(verdict: Verdict) {
			if (disposed || shown) return;
			shown = true;
			previous =
				document.activeElement instanceof HTMLElement
					? document.activeElement
					: null;
			const state =
				verdict.winner === 'draw'
					? 'draw'
					: verdict.winner === verdict.humanSide
						? 'win'
						: 'loss';
			root.dataset.outcome = state;
			heading.textContent =
				state === 'win' ? 'Победа' : state === 'loss' ? 'Поражение' : 'Ничья';
			reason.textContent = verdict.reason;
			againLabel.textContent = verdict.online
				? 'Найти соперника'
				: 'Ещё партия';
			reopen.setAttribute(
				'aria-label',
				`Результат партии: ${heading.textContent.toLowerCase()}`,
			);
			root.hidden = false;
			open(false);
			performance.mark('damka:result-actions-ready');
			frame = requestAnimationFrame(() => {
				if (shown) performance.mark('damka:result-render-opportunity');
			});
		},
	};
}
