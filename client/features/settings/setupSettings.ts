import { requiredElement } from '@/client/platform/browser/dom';
import { bindDialogNavigation } from '@/client/platform/browser/dialogNavigation';
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
const skills: BotSkill[] = ['easy', 'normal', 'hard'];
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
const dialog = requiredElement<HTMLDialogElement>('opening-settings-dialog');
const navigation = bindDialogNavigation(dialog);
if (import.meta.hot) import.meta.hot.dispose(navigation.dispose);
function sync(): void {
	input('settings-auto').checked = state.autoMove;
	input('settings-muted').checked = state.muted;
	for (const key of ['music', 'effects'] as const) {
		input(`settings-${key}`).value = String(state[key]);
		requiredElement(`settings-${key}-value`).textContent =
			`${Math.round(state[key] * 100)}%`;
	}
	for (const skill of skills)
		input(`settings-bot-${skill}`).checked = state.botSkill === skill;
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
		} catch {}
		window.dispatchEvent(
			new CustomEvent('checkers-settings-change', { detail: patch }),
		);
	},
	open: () => {
		sync();
		navigation.open();
	},
};
input('settings-auto').onchange = () =>
	window.checkersSettings.set({ autoMove: input('settings-auto').checked });
input('settings-muted').onchange = () =>
	window.checkersSettings.set({ muted: input('settings-muted').checked });
for (const skill of skills)
	input(`settings-bot-${skill}`).onchange = () => {
		if (input(`settings-bot-${skill}`).checked)
			window.checkersSettings.set({ botSkill: skill });
	};
for (const key of ['music', 'effects'] as const)
	input(`settings-${key}`).oninput = () => {
		window.checkersSettings.set({
			[key]: Number(input(`settings-${key}`).value),
		});
	};
requiredElement('opening-options').onclick = () =>
	window.checkersSettings.open();
dialog.addEventListener('keydown', (event) => {
	if (event.key !== 'Tab') return;
	const controls = [
		...dialog.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
			'input, button',
		),
	].filter((control) => !control.disabled);
	const first = controls[0],
		last = controls[controls.length - 1];
	if (
		event.shiftKey &&
		(document.activeElement === first ||
			!controls.some((control) => control === document.activeElement))
	) {
		event.preventDefault();
		last?.focus();
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first?.focus();
	}
});
dialog.addEventListener('close', () => {
	const root = requiredElement('opening');
	if (!root.hidden && !root.inert)
		requiredElement('opening-options').focus({ preventScroll: true });
});
sync();
