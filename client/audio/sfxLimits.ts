/** Caps include the short tail of previous effects; voices have their own owner. */
export function sfxCategory(name: string): { key: string; cap: number } {
	if (/^(ui-|panel-ready|undo-applied|menu-contact)/.test(name))
		return { key: 'ui', cap: 2 };
	if (/^(select-b|move-w|b-click|crush-b|ah|ignite-a|trail-b)/.test(name))
		return { key: 'piece', cap: 4 };
	return { key: 'scene', cap: 4 };
}
