import { requiredElement } from '@/client/platform/browser/dom';
import type { BotSkill, Settings } from './settings';

const keys = {
	master: 'checkers.sfxMaster',
	muted: 'checkers.sfxMuted',
	effects: 'checkers.effectsVolume',
	music: 'checkers.musicVolume',
	autoMove: 'checkers.autoMove',
	botSkill: 'checkers.botSkill',
} as const;
const levels = ['master', 'music', 'effects'] as const;
function read(key: keyof Settings): string | null {
	try {
		return localStorage.getItem(keys[key]);
	} catch {
		return null;
	}
}
function numeric(raw: string | null, fallback: number): number {
	return raw === null || raw === '' || !Number.isFinite(Number(raw))
		? fallback
		: Math.max(0, Math.min(1, Number(raw)));
}
function botSkillOf(raw: string | null | undefined): BotSkill {
	return raw === 'easy' || raw === 'hard' || raw === 'normal' ? raw : 'normal';
}
const state: Settings = {
	master: numeric(read('master'), 0.4),
	effects: numeric(read('effects'), 1),
	music: numeric(read('music'), 1),
	muted: ['1', 'true'].includes(read('muted') ?? ''),
	autoMove: !['0', 'false'].includes(read('autoMove') ?? ''),
	botSkill: botSkillOf(read('botSkill')),
};
if (state.master === 0) {
	state.master = 0.4;
	state.muted = true;
}
const input = (id: string) => requiredElement<HTMLInputElement>(id);
function sync(): void {
	input('settings-auto').checked = state.autoMove;
	input('settings-muted').checked = state.muted;
	for (const key of ['music', 'effects'] as const) {
		input(`settings-${key}`).value = String(state[key]);
		requiredElement(`settings-${key}-value`).textContent =
			`${Math.round(state[key] * 100)}%`;
	}
}
window.checkersSettings = {
	get: () => ({ ...state }),
	set: (patch) => {
		for (const key of levels)
			if (key in patch) state[key] = numeric(String(patch[key]), state[key]);
		if ('muted' in patch) state.muted = Boolean(patch.muted);
		if ('autoMove' in patch) state.autoMove = Boolean(patch.autoMove);
		if ('botSkill' in patch) state.botSkill = botSkillOf(patch.botSkill);
		sync();
		try {
			for (const key of Object.keys(keys) as (keyof Settings)[]) {
				const value = state[key];
				localStorage.setItem(
					keys[key],
					typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
				);
			}
			requiredElement('settings-save-status').textContent =
				'Сохраняется автоматически';
		} catch {
			requiredElement('settings-save-status').textContent =
				'Не удалось сохранить. Изменения действуют до обновления страницы.';
		}
		window.dispatchEvent(
			new CustomEvent('checkers-settings-change', { detail: patch }),
		);
	},
	open: () => {
		sync();
		window.dispatchEvent(
			new CustomEvent('checkers-profile-open', { detail: 'settings' }),
		);
	},
};
input('settings-auto').onchange = () =>
	window.checkersSettings.set({ autoMove: input('settings-auto').checked });
input('settings-muted').onchange = () =>
	window.checkersSettings.set({ muted: input('settings-muted').checked });
for (const key of ['music', 'effects'] as const)
	input(`settings-${key}`).oninput = () => {
		window.checkersSettings.set({
			[key]: Number(input(`settings-${key}`).value),
		});
	};
requiredElement('opening-options').onclick = () =>
	window.checkersSettings.open();
sync();
