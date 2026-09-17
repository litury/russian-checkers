import {describe, expect, it} from 'vitest';
import {apiOrigin, wsUrl} from './apiOrigin';

describe('apiOrigin', () => {
	it('uses VITE_API_URL when set', () => {
		expect(apiOrigin('https://api.damka.example/', {protocol: 'https:', hostname: 'play.example', host: 'play.example'})).toBe(
			'https://api.damka.example',
		);
	});

	it('keeps local vite on port 8787', () => {
		expect(apiOrigin('', {protocol: 'http:', hostname: 'localhost', host: 'localhost:5173'})).toBe(
			'http://localhost:8787',
		);
		expect(apiOrigin(undefined, {protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1:5173'})).toBe(
			'http://127.0.0.1:8787',
		);
	});

	it('uses same host as the page in production without env', () => {
		expect(apiOrigin('', {protocol: 'https:', hostname: 'damka.example', host: 'damka.example'})).toBe(
			'https://damka.example',
		);
	});

	it('maps https API origin to wss /ws without localhost', () => {
		expect(wsUrl('https://api.damka.example')).toBe('wss://api.damka.example/ws');
		expect(wsUrl('http://localhost:8787')).toBe('ws://localhost:8787/ws');
	});
});
