import { loadImage } from '@/client/platform/browser/assetLoader';
import definition from './assets/menu-controls/atlas.json';

type Variants = Record<string, readonly (readonly number[])[]>;
const atlasUrl = new URL('./assets/menu-controls/atlas.webp', import.meta.url)
	.href;
const [atlasWidth, atlasHeight] = definition.size;
document.body.style.setProperty('--menu-atlas', `url("${atlasUrl}")`);
document.body.dataset.menuAtlas = 'loading';
const atlasReady = loadImage(atlasUrl).then(
	() => {
		document.body.dataset.menuAtlas = 'ready';
	},
	() => {
		document.body.dataset.menuAtlas = 'unavailable';
		throw new Error('Menu atlas unavailable');
	},
);
const backgroundUrl = new URL(
	'./assets/menu-controls/background.webp',
	import.meta.url,
).href;
void Promise.allSettled([
	atlasReady,
	loadImage(backgroundUrl),
	document.fonts.load('600 24px Literata', 'Русские шашки'),
	document.fonts.load('600 20px "Golos Text"', 'Играть Профиль'),
	document.fonts.load('400 12px "Golos Text"', 'Общий счёт'),
]).then((results) => {
	document.documentElement.dataset.menuPresentation = results.every(
		(result) => result.status === 'fulfilled',
	)
		? 'ready'
		: 'fallback';
	document.dispatchEvent(new Event('damka:menu-art-settled'));
});

function position(rectangle: readonly number[]) {
	const [left, top, width, height] = rectangle;
	return `${(left / (atlasWidth - width)) * 100}% ${(top / (atlasHeight - height)) * 100}%`;
}

function decorate(host: HTMLElement, variants: Variants, insets: number[]) {
	if (host.querySelector(':scope > .sprite-art')) return;
	const art = document.createElement('span');
	art.className = 'sprite-art';
	art.setAttribute('aria-hidden', 'true');
	const [top, right, bottom, left] = insets;
	art.style.setProperty('--slice-top', `${top}px`);
	art.style.setProperty('--slice-right', `${right}px`);
	art.style.setProperty('--slice-bottom', `${bottom}px`);
	art.style.setProperty('--slice-left', `${left}px`);
	const baseline = variants.rest ?? variants.normal;
	for (const [index, rectangle] of baseline.entries()) {
		const cell = document.createElement('span');
		cell.className = 'sprite-slice';
		if (rectangle[2] === 1 && rectangle[3] === 1) {
			cell.style.backgroundImage = 'none';
			art.append(cell);
			continue;
		}
		cell.style.backgroundSize = `${(atlasWidth / rectangle[2]) * 100}% ${(atlasHeight / rectangle[3]) * 100}%`;
		cell.style.setProperty('--sprite-rest', position(rectangle));
		for (const [state, rectangles] of Object.entries(variants))
			cell.style.setProperty(`--sprite-${state}`, position(rectangles[index]));
		art.append(cell);
	}
	host.prepend(art);
}

export function decorateMenu(root: ParentNode) {
	for (const option of root.querySelectorAll<HTMLElement>(
		'.difficulty-option, .menu-chip',
	))
		decorate(option, definition.chip.skins, definition.chip.cssInsets);
	for (const button of root.querySelectorAll<HTMLElement>('.metal-button')) {
		const skin = button.classList.contains('secondary')
			? 'secondary'
			: 'primary';
		decorate(
			button,
			definition.button.skins[skin],
			definition.button.cssInsets,
		);
	}
	for (const [selector, surface] of [
		['.game-title', definition.title],
		['.menu-choice-surface', definition.choice],
		['.menu-score-surface', definition.footer],
	] as const)
		for (const host of root.querySelectorAll<HTMLElement>(selector))
			decorate(host, surface.skins, surface.cssInsets);
}

decorateMenu(document);
const observer = new MutationObserver((records) => {
	for (const record of records) {
		for (const node of record.addedNodes) {
			if (node instanceof HTMLElement) {
				if (
					node.matches(
						'.metal-button, .difficulty-option, .menu-chip, .game-title, .menu-choice-surface, .menu-score-surface',
					)
				)
					decorateMenu(node.parentNode ?? document);
				else decorateMenu(node);
			}
		}
	}
});
observer.observe(document.body, { childList: true, subtree: true });
if (import.meta.hot) import.meta.hot.dispose(() => observer.disconnect());
