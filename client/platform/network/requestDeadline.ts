export function requestDeadline(
	_milliseconds: number,
	_parent?: AbortSignal | null,
) {
	const controller = new AbortController();
	let timedOut = false;
	const cancel = () => {
		controller.abort(_parent?.reason);
		dispose();
	};
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort(new DOMException('Request deadline', 'TimeoutError'));
		dispose();
	}, _milliseconds);
	function dispose() {
		clearTimeout(timer);
		_parent?.removeEventListener('abort', cancel);
	}
	if (_parent?.aborted) cancel();
	else _parent?.addEventListener('abort', cancel, { once: true });
	return { signal: controller.signal, timedOut: () => timedOut, dispose };
}
