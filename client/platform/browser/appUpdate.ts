import { recordNetworkDiagnostic } from '../network/networkDiagnostics';

let assetFailure = false;

export function hasAssetFailure() {
	return assetFailure;
}

export function reloadFromMenu(): boolean {
	const opening = document.getElementById('opening');
	if (!opening || opening.hidden || window.checkersStartup?.playCommitted)
		return false;
	location.reload();
	return true;
}

export function bindAppUpdates() {
	window.addEventListener('vite:preloadError', () => {
		assetFailure = true;
		recordNetworkDiagnostic({
			transport: 'assets',
			phase: 'loading',
			result: 'rejected',
			elapsedMs: 0,
			reason: 'asset_load_failed',
		});
		const status = document.getElementById('settings-update-status');
		if (status)
			status.textContent =
				'Не удалось загрузить файлы игры. Обновите страницу из меню.';
	});
}
