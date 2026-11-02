export function connectionDiagnostic(
	_reason: 'update_required' | 'unauthorized',
	_protocol: unknown,
	_build: unknown,
) {
	return {
		event: 'ws_auth_rejected',
		reason: _reason,
		protocol:
			typeof _protocol === 'number' &&
			Number.isInteger(_protocol) &&
			_protocol >= 0 &&
			_protocol < 1000
				? _protocol
				: null,
		build:
			typeof _build === 'string' &&
			/^(?:dev|build)-\d{17}-[a-f0-9]{6}$/.test(_build)
				? _build
				: 'unknown',
	};
}
