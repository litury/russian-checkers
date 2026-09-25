import { describe, expect, it } from 'vitest';
import html from '../../../index.html?raw';
import board from '../modules/board/createReliquaryBoardView.ts?raw';
import history from './matchHistory.css?raw';
import opening from './openingGates.css?raw';
import result from './resultCeremony.css?raw';

const css = (text: string) => text.replace(/\s+/g, ' ');

describe('touch focus ring', () => {
	it('keeps the outline for the keyboard only', () => {
		expect(html).toContain(
			"addEventListener('keydown', () => setInputMode('keyboard'), true)",
		);
		expect(html).toContain(
			"addEventListener('pointerdown', () => setInputMode('pointer'), true)",
		);
		expect(css(html)).toContain('html[data-input-mode=pointer] :focus-visible');
		expect(css(html)).toContain('html[data-input-mode=pointer] :focus');
		// The ring itself must survive: only the pointer branch removes it.
		expect(css(html)).toContain(
			'button:focus-visible,input:focus-visible{outline:3px solid #bed9ec',
		);
		// No pointer-gated rule may retire the visible keyboard ring.
		expect(html).not.toMatch(
			/data-input-mode=keyboard[^{]*\{[^}]*outline:none/,
		);
	});

	it('cancels the ring on every surface that draws one', () => {
		for (const sheet of [opening, history, result]) {
			expect(css(sheet)).toContain('html[data-input-mode=pointer]');
			expect(css(sheet)).toContain('outline:none');
		}
		expect(css(opening)).toContain(
			'#opening button:focus-visible { outline:3px solid #bed9ec',
		);
		expect(css(opening)).toContain(
			'html[data-input-mode=pointer] #opening button:focus-visible { outline:none; }',
		);
		expect(css(opening)).toContain(
			'html[data-input-mode=pointer] #match-undo:focus-visible,html[data-input-mode=pointer] #match-resign:focus-visible{outline:none}',
		);
		expect(css(history)).toContain(
			'html[data-input-mode=pointer] #match-history :focus-visible { outline:none; }',
		);
		expect(css(result)).toContain(
			'html[data-input-mode=pointer] .result-actions button:focus-visible{outline:none}',
		);
	});

	it('darkens the tap highlight instead of flashing the default one', () => {
		expect(css(html)).toContain(
			'*{box-sizing:border-box;-webkit-tap-highlight-color:rgba(0,0,0,.3)}',
		);
	});

	it('does not draw the board keyboard highlight after a tap', () => {
		expect(board).toContain(
			"document.documentElement.dataset.inputMode !== 'pointer'",
		);
		expect(board).toContain("canvas.matches(':focus-visible')");
	});
});
