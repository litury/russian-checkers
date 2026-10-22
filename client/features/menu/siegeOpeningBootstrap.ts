import { mountSiegeOpening } from './siegeOpening';

const root = document.getElementById('opening');
if (root) {
	let dispose: (() => void) | undefined;
	const sync = () => {
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
			);
		}
	};
	const observer = new MutationObserver(sync);
	observer.observe(document.body, {
		subtree: true,
		attributes: true,
		attributeFilter: ['open', 'hidden', 'inert'],
	});
	sync();
	if (import.meta.hot)
		import.meta.hot.dispose(() => {
			observer.disconnect();
			dispose?.();
		});
}
