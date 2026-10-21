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
					.catch(() =>
						window.checkersStartup.fail(
							'Не удалось запустить игру. Проверьте соединение и повторите загрузку.',
						),
					);
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
