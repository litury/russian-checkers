import { expect, it } from 'vitest';
import { bindHost, bindMessage } from './bind.ts';
it('preserves container bind default and validates explicit HOST', () => {
 expect(bindHost(undefined)).toBe('::');
 for (const host of ['127.0.0.1', '0.0.0.0', '::1', 'localhost']) expect(bindHost(host)).toBe(host);
 for (const host of ['', ' ', 'https://example.com', 'bad-host']) expect(() => bindHost(host)).toThrow();
});
it('logs actual bound IP and dynamically assigned port', () => {
 expect(bindMessage({ address: '::1', family: 'IPv6', port: 54321 })).toBe('checkers-server bound http://[::1]:54321 ws://[::1]:54321/ws');
 expect(bindMessage({ address: '127.0.0.1', family: 'IPv4', port: 54322 })).toContain('127.0.0.1:54322');
 expect(() => bindMessage(null)).toThrow();
});
