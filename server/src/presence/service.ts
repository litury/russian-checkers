import {
	countHeartbeats,
	dropHeartbeat,
	touchHeartbeat,
} from './heartbeats.ts';
export function createPresenceService() {
	const heartbeats = new Map<string, number>();
	const siteLive = () => countHeartbeats(heartbeats, Date.now());
	return {
		siteLive,
		touch(player: string) {
			touchHeartbeat(heartbeats, player, Date.now());
		},
		drop(player: string) {
			dropHeartbeat(heartbeats, player);
		},
	};
}
export type PresenceService = ReturnType<typeof createPresenceService>;
