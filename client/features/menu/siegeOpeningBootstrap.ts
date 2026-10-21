import { mountSiegeOpening } from './siegeOpening';

const root = document.getElementById('opening');
if (root) {
 const dispose = mountSiegeOpening(root, () => !!(
  window.checkersStartup?.pendingPlay || window.checkersStartup?.playCommitted || window.checkersStartup?.pendingOnline
 ));
 if (import.meta.hot) import.meta.hot.dispose(dispose);
}
