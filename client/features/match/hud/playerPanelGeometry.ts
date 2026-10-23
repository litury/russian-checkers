import { actionTarget, compactPanelHeight } from '../actions/actionLayout';

export function playerPanelGeometry(width: number, height: number) {
	const compact = height < compactPanelHeight;
	const inset = 14;
	const clockWidth = compact ? 112 : Math.max(112, Math.min(132, width * 0.35));
	const clockLeft = width - inset - clockWidth;
	const informationWidth = clockLeft - inset - 10;
	return {
		compact,
		clock: {
			x: clockLeft,
			y: compact ? 3 : (height - 58) / 2,
			width: clockWidth,
			height: compact ? 24 : 58,
		},
		identity: {
			x: inset,
			y: compact ? 5 : (height - 68) / 2,
			width: informationWidth,
			height: compact ? height - 10 : 68,
		},
		status: compact
			? { x: clockLeft, y: 29, width: clockWidth, height: height - 33 }
			: {
					x: inset,
					y: 8,
					width: informationWidth,
					height: height - actionTarget.height - 24,
				},
		actions: {
			x: inset,
			y: compact
				? (height - actionTarget.height) / 2
				: height - actionTarget.height - 12,
			width: Math.min(actionTarget.width * 2, informationWidth),
			height: actionTarget.height,
		},
	};
}
