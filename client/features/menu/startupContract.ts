export interface MenuStartup {
	watchdog: number;
	framePresented: boolean;
	engineLoaded: boolean;
	pendingPlay?: boolean;
	playCommitted?: boolean;
	playIntent?: ((event?: Event) => void) | null;
	onlineIntent?: ((event?: Event) => void) | null;
	pendingOnline?: boolean;
	playIntentAt?: number | null;
	onlineIntentAt?: number | null;
	source?: 'play' | 'online';
	presented(): void;
	engineReady(): void;
	fail(message: string): void;
	unlock(): void;
	waitPlay(): void;
	waitOnline(): void;
	idlePlay(): void;
	idleOnline(): void;
	ready(): void;
	slow(): void;
	progress(message: string): void;
	status(message: string): void;
}

declare global {
	interface Window {
		checkersStartup: MenuStartup;
		checkersFlavor?: { setState(next: string): void };
		checkersRules: { open(): void };
	}
}
