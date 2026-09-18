export type BotSkill = 'easy' | 'normal' | 'hard';

export type Settings = {
	master: number;
	muted: boolean;
	effects: number;
	music: number;
	autoMove: boolean;
	botSkill: BotSkill;
};

declare global {
	interface Window {
		checkersSettings: {
			get: () => Settings;
			set: (patch: Partial<Settings>) => void;
			open: () => void;
		};
	}
}

export const autoStorageKey = 'checkers.autoMove';
let autoMove = true;
try {
	const raw = globalThis.localStorage?.getItem(autoStorageKey);
	autoMove = raw !== '0' && raw !== 'false';
} catch {}
export function getAutoMove(): boolean {
	return typeof window !== 'undefined' && window.checkersSettings
		? window.checkersSettings.get().autoMove
		: autoMove;
}
const botSkills: BotSkill[] = ['easy', 'normal', 'hard'];
let botSkill: BotSkill = 'normal';
try {
	const raw = globalThis.localStorage?.getItem('checkers.botSkill');
	if (raw === 'easy' || raw === 'normal' || raw === 'hard') botSkill = raw;
} catch {}
export function getBotSkill(): BotSkill {
	return typeof window !== 'undefined' && window.checkersSettings
		? window.checkersSettings.get().botSkill ?? botSkill
		: botSkill;
}
export function setBotSkill(next: BotSkill): void {
	botSkill = botSkills.includes(next) ? next : 'normal';
	if (typeof window !== 'undefined' && window.checkersSettings)
		window.checkersSettings.set({ botSkill });
}

export function setAutoMove(on: boolean): void {
	autoMove = on;
	if (typeof window !== 'undefined' && window.checkersSettings)
		window.checkersSettings.set({ autoMove: on });
	else {
		try {
			globalThis.localStorage?.setItem(autoStorageKey, on ? '1' : '0');
		} catch {}
	}
}
