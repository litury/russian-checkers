export type Settings = {
	master: number;
	muted: boolean;
	effects: number;
	music: number;
	autoMove: boolean;
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
