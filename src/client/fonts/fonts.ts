export const hudFont = "Tiny5";
export const titleFont = "Russo One";
export const hudFontPx = 32;
export const clockFontPx = 15;

export function whenHudFontReady(then: () => void): void {
	const fonts = (
		globalThis as {
			document?: { fonts?: { load?: (q: string) => Promise<unknown> } };
		}
	).document?.fonts;
	if (typeof fonts?.load !== 'function') {
		then();
		return;
	}
	void fonts.load(`${clockFontPx}px ${hudFont}`).then(then, then);
}
