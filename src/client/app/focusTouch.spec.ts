import { describe, expect, it } from 'vitest';
import html from '../../../index.html?raw';
import board from '../modules/board/createReliquaryBoardView.ts?raw';
import history from './matchHistory.css?raw';
import opening from './openingGates.css?raw';
import result from './resultCeremony.css?raw';

const css = (text: string) => text.replace(/\s+/g, ' ');

describe('touch focus ring', () => {
	it('keeps the outline for the keyboard only', () => {
		// The ring itself must survive: only the marked (pointer-focused)
		// element loses it.
		expect(css(html)).toContain(
			'button:focus-visible,input:focus-visible{outline:3px solid #bed9ec',
		);
		expect(css(html)).toContain(
			'[data-pointer-focus]:focus-visible,[data-pointer-focus]:focus{outline:none}',
		);
		// A global last-input flag used to suppress every later focus, including
		// screen-reader and scripted focus. It must stay gone.
		expect(html).not.toContain('data-input-mode');
	});

	it('cancels the ring on every surface that draws one', () => {
		for (const sheet of [opening, history, result]) {
			expect(css(sheet)).toContain('[data-pointer-focus]');
			expect(css(sheet)).toContain('outline:none');
			expect(css(sheet)).not.toContain('data-input-mode');
		}
		expect(css(opening)).toContain(
			'#opening button:focus-visible { outline:3px solid #bed9ec',
		);
		expect(css(opening)).toContain(
			'#opening button[data-pointer-focus]:focus-visible { outline:none; }',
		);
		expect(css(opening)).toContain(
			'#match-undo[data-pointer-focus]:focus-visible,#match-resign[data-pointer-focus]:focus-visible{outline:none}',
		);
		expect(css(history)).toContain(
			'#match-history [data-pointer-focus]:focus-visible { outline:none; }',
		);
		expect(css(result)).toContain(
			'.result-actions button[data-pointer-focus]:focus-visible{outline:none}',
		);
	});

	it('loads the tracker that owns the mark', () => {
		expect(html).toContain(
			'<script type="module" src="/src/client/app/pointerFocusRing.ts">',
		);
	});

	it('removes the tap highlight instead of repainting it', () => {
		// The player's complaint was a visible tap fill. It must be gone, not
		// recoloured: any alpha > 0 (e.g. rgba(0,0,0,.3)) is still a plaque.
		expect(css(html)).toContain(
			'*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}',
		);
		expect(css(html)).not.toMatch(/-webkit-tap-highlight-color:\s*rgba?\(/);
	});

	it('does not draw the board keyboard highlight after a tap', () => {
		expect(board).toContain('!canvas.hasAttribute(POINTER_FOCUS_ATTR)');
		expect(board).toContain("canvas.matches(':focus-visible')");
	});
});
