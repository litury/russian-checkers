import type { IMove, IPosition } from '@/rules';
import { isKingRow } from '@/rules/parts/board';
import { capturedOnSegment } from '@/rules/parts/capturedOnPath';

export const HAPTIC_PATTERNS = {
	tick: 10,
	move: 15,
	capture: 23,
	promotion: [12, 45, 12],
} as const;
export type HapticKind = keyof typeof HAPTIC_PATTERNS;
export const HAPTIC_STORAGE_KEY = 'checkers.menuVibration';

/** Best effort only: never couples device feedback to game state or audio. */
export class Haptics {
	private enabled = false;
	private seen = new WeakSet<object>();
	constructor(
		private readonly env: {
			storage: () => Pick<Storage, 'getItem' | 'setItem'> | undefined;
			hidden: () => boolean;
			vibrate: (pattern: number | number[]) => boolean;
		},
	) {
		try {
			this.enabled = env.storage()?.getItem(HAPTIC_STORAGE_KEY) === 'true';
		} catch {
			/* private storage */
		}
	}
	get isEnabled(): boolean {
		return this.enabled;
	}
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		try {
			this.env.storage()?.setItem(HAPTIC_STORAGE_KEY, String(enabled));
		} catch {
			/* optional persistence */
		}
		if (enabled) this.play('tick');
		else this.cancel();
	}
	play(kind: HapticKind, action?: object): void {
		if (action && this.seen.has(action)) return;
		if (action) this.seen.add(action);
		if (!this.enabled || this.env.hidden()) return;
		const pattern = HAPTIC_PATTERNS[kind];
		try {
			this.env.vibrate(typeof pattern === 'number' ? pattern : [...pattern]);
		} catch {
			/* unsupported or denied */
		}
	}
	cancel(): void {
		try {
			this.env.vibrate(0);
		} catch {
			/* unsupported or denied */
		}
	}
}

export const haptics = new Haptics({
	storage: () =>
		typeof localStorage === 'undefined' ? undefined : localStorage,
	hidden: () => typeof document === 'undefined' || document.hidden,
	vibrate: (pattern) =>
		typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
			? navigator.vibrate(pattern)
			: false,
});

/** Per landing, including promotion midway through a multi-capture route. */
export function moveHapticKinds(
	position: IPosition,
	move: IMove,
): HapticKind[] {
	const piece = position.squares[move.from.row][move.from.col];
	if (!piece) return [];
	let from = move.from;
	let king = piece.kind === 'king';
	return move.path.map((land) => {
		const promotion = !king && isKingRow(land, piece.side);
		const kind = promotion
			? 'promotion'
			: capturedOnSegment(position, from, land)
				? 'capture'
				: 'move';
		king ||= promotion;
		from = land;
		return kind;
	});
}

/** Bubble after the real control handler; cancelled clicks and disabled controls are silent. */
export function mountHapticControls(doc: Document): () => void {
	const acceptedControls = new WeakSet<Event>();
	const setting = doc.getElementById(
		'settings-vibration',
	) as HTMLInputElement | null;
	if (setting) setting.checked = haptics.isEnabled;
	const change = (event: Event) => {
		if (!event.isTrusted || event.defaultPrevented) return;
		if (event.target === setting) {
			haptics.setEnabled(!!setting?.checked);
			return;
		}
		const target = event.target;
		if (
			target instanceof HTMLInputElement &&
			['checkbox', 'radio'].includes(target.type) &&
			!target.disabled
		)
			haptics.play('tick', event);
	};
	const click = (event: MouseEvent) => {
		if (event.defaultPrevented || !acceptedControls.has(event)) return;
		haptics.play('tick', event);
	};
	const capture = (event: MouseEvent) => {
		if (!event.isTrusted || !(event.target instanceof Element)) return;
		const control = event.target.closest('button, [role="button"]');
		if (
			!control ||
			control.matches(':disabled, [aria-disabled="true"]') ||
			control.closest('[inert], [hidden]')
		)
			return;
		acceptedControls.add(event);
	};
	const visibility = () => {
		if (doc.hidden) haptics.cancel();
	};
	doc.addEventListener('click', click);
	doc.addEventListener('click', capture, true);
	doc.addEventListener('change', change);
	doc.addEventListener('visibilitychange', visibility);
	return () => {
		doc.removeEventListener('click', click);
		doc.removeEventListener('click', capture, true);
		doc.removeEventListener('change', change);
		doc.removeEventListener('visibilitychange', visibility);
		haptics.cancel();
	};
}
