import { reloadFromMenu } from '@/client/platform/browser/appUpdate';
import { BUILD_ID } from '@/client/platform/browser/buildInfo';
import { requiredElement } from '@/client/platform/browser/dom';
import { networkReport } from '@/client/platform/network/networkDiagnostics';

export function bindBuildDiagnostics() {
	requiredElement('settings-build').textContent = `Сборка ${BUILD_ID}`;
	for (const [buttonId, statusId, outputId] of [
		[
			'settings-diagnostics',
			'settings-diagnostic-status',
			'settings-diagnostic-output',
		],
		[
			'opening-search-diagnostics',
			'search-diagnostic-status',
			'search-diagnostic-output',
		],
		[
			'startup-diagnostics',
			'startup-diagnostic-status',
			'startup-diagnostic-output',
		],
	]) {
		const button = requiredElement<HTMLButtonElement>(buttonId);
		const status = requiredElement(statusId);
		const output = requiredElement<HTMLTextAreaElement>(outputId);
		button.addEventListener('click', async () => {
			const report = networkReport();
			try {
				await navigator.clipboard.writeText(report);
				output.hidden = true;
				status.textContent =
					'Диагностика скопирована. Токенов и почты в ней нет.';
			} catch {
				output.value = report;
				output.hidden = false;
				output.focus();
				output.select();
				status.textContent = 'Скопируйте выделенный текст.';
			}
		});
	}
	for (const buttonId of ['settings-update', 'opening-search-update']) {
		requiredElement(buttonId).addEventListener('click', () => {
			if (!reloadFromMenu())
				requiredElement('settings-update-status').textContent =
					'Обновление доступно из главного меню после партии.';
		});
	}
}
