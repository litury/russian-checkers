import { bindAppUpdates, hasAssetFailure } from '../platform/browser/appUpdate';

bindAppUpdates();
// Yield a paint opportunity; image and font loading never gate the engine.
const bootGame = () =>
	requestAnimationFrame(() =>
		requestAnimationFrame(() => {
			// Let HTML/CSS paint before a warm cached engine evaluates.
			performance.mark('damka:menu-presented');
			window.checkersStartup.presented();
			const importEngine = () =>
				import('./main')
					.then(() => {
						performance.mark('damka:engine-ready');
						window.checkersStartup.engineReady();
					})
					.catch(() => {
						window.checkersStartup.fail(hasAssetFailure()
							? 'Не удалось загрузить файлы игры. Возможно, вышла новая версия. Обновите игру; профиль сохранится.'
							: 'Не удалось запустить игру. Проверьте соединение или обновите браузер.');
						const diagnostics = document.getElementById('startup-diagnostic-tools');
						if (diagnostics) diagnostics.hidden = false;
						const retry = document.getElementById('opening-retry');
						if (retry && hasAssetFailure()) retry.textContent = 'Обновить игру';
					});
			// Preserve the first two seconds for this screen, then quietly warm the board.
			setTimeout(
				() => {
					if ('requestIdleCallback' in window)
						window.requestIdleCallback(importEngine, { timeout: 500 });
					else importEngine();
				},
				Math.max(0, 2000 - performance.now()),
			);
		}),
	);
bootGame();
