import type { IPosition, Side } from '../../../shared/rules/index.ts';
import type { SelectableTimeControl } from '../../../shared/rules/timeControl.ts';

export interface MatchRuntime {
	version: 1;
	white: string;
	black: string;
	position: IPosition;
	ply: number;
	keys: string[];
	begun: boolean;
	banks: Record<Side, number>;
	turnStarted: number;
	friend: boolean;
	friendCode?: string;
	timeControl: SelectableTimeControl;
	drawOffer: Side | null;
	lastDrawOffer: Side | null;
	dropDeadlines: Record<string, number>;
}
