export interface IYandexSdk {
	isStub: boolean;
	ready: () => void;
	showFullscreenAdv: (handlers: {
		onOpen?: () => void;
		onClose?: (wasShown: boolean) => void;
		onError?: () => void;
	}) => void;
	onPause: (callback: () => void) => void;
	onResume: (callback: () => void) => void;
}
