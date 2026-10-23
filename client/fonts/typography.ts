export type TextRole =
	| 'caption'
	| 'label'
	| 'hud-name'
	| 'hud-name-compact'
	| 'hud-status'
	| 'hud-status-compact'
	| 'hud-result'
	| 'hud-result-compact'
	| 'clock'
	| 'clock-compact';

export function readTextRole(role: TextRole) {
	const probe = document.createElement('span');
	probe.style.font = `var(--type-${role})`;
	probe.hidden = true;
	document.body.append(probe);
	const style = getComputedStyle(probe);
	const fontSize = Number.parseFloat(style.fontSize);
	const result = {
		fontFamily: style.fontFamily,
		fontSize,
		fontStyle: style.fontWeight,
		lineSpacing: Math.max(
			0,
			(Number.parseFloat(style.lineHeight) || fontSize) - fontSize,
		),
	};
	probe.remove();
	return result;
}

export function readTextSpacing() {
	const style = getComputedStyle(document.documentElement);
	return {
		inset: Number.parseFloat(style.getPropertyValue('--text-inset-block')) || 8,
		compactInset:
			Number.parseFloat(style.getPropertyValue('--text-inset-compact')) || 6,
		gap: Number.parseFloat(style.getPropertyValue('--text-line-gap')) || 5,
	};
}
