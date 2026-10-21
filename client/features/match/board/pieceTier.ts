/** Geometry of the approved menu/v2 layers (siege/provenance.json).
 * The moving 450x402 insert is NOT a second 724x724 checker.
 */
export const pieceTierParts = ['base', 'moving', 'front'] as const;
export const pieceTierKey = (
	side: 'white' | 'black',
	part: (typeof pieceTierParts)[number],
) => `piece-tier-${side}-${part}`;
export function pieceTierPose(cell: number, progress: number) {
	const scale = ((35 / 648) * cell) / 44;
	const restY = (17.6 * cell) / 44;
	return {
		scale,
		x: -365 * scale,
		y: restY - 679 * scale,
		movingX: (141 - 365) * scale,
		movingY:
			restY + (160 - 679 - 55 * Math.max(0, Math.min(1, progress))) * scale,
	};
}
