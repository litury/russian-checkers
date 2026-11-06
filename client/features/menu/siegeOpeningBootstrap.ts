import { readPerf } from '@/client/platform/browser/perfMarks';
import { menuPresentationReady } from './menuAtlas';
import { mountSiegeOpening } from './siegeOpening';

const root = document.getElementById('opening');
if (root) {
	let dispose: (() => void) | undefined;
	let presentationReady = false;
	let playfieldReady = readPerf().marks['playfield-ready'] !== undefined;
	const sync = () => {
		if (!presentationReady) return;
		if (root.hidden || root.inert || document.querySelector('dialog[open]')) {
			dispose?.();
			dispose = undefined;
		} else if (!dispose) {
			dispose = mountSiegeOpening(root, () =>
				Boolean(
					window.checkersStartup?.pendingPlay ||
						window.checkersStartup?.playCommitted ||
						window.checkersStartup?.pendingOnline,
				),
				() => playfieldReady,
			);
		}
	};
	const observer = new MutationObserver(sync);
	observer.observe(document.body, {
		subtree: true,
		attributes: true,
		attributeFilter: ['open', 'hidden', 'inert'],
	});
	void menuPresentationReady.then((ready) => {
		presentationReady = ready;
		sync();
	});
	const onPlayfieldReady = () => {
		playfieldReady = true;
		sync();
	};
	document.addEventListener('damka:playfield-ready', onPlayfieldReady);
	if (import.meta.hot)
		import.meta.hot.dispose(() => {
			document.removeEventListener('damka:playfield-ready', onPlayfieldReady);
			observer.disconnect();
			dispose?.();
		});
}
