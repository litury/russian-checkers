import { expect, it } from 'vitest';
import { devProxyConfig, HTTP_API_ROUTE, WS_API_ROUTE } from './proxyConfig';
it('matches endpoint, query and nested path boundaries, not lookalikes', () => {
 const http = new RegExp(HTTP_API_ROUTE);
 for (const root of ['health','stats','presence','players','auth','matches']) {
  for (const suffix of ['', '?limit=20', '/child?x=1']) expect(http.test(`/${root}${suffix}`)).toBe(true);
  for (const suffix of ['x', '-page', '.js']) expect(http.test(`/${root}${suffix}`)).toBe(false);
 }
 const ws = new RegExp(WS_API_ROUTE);
 expect(ws.test('/ws')).toBe(true);
 expect(ws.test('/ws?probe=1')).toBe(true);
 expect(ws.test('/ws-other')).toBe(false);
 expect(ws.test('/ws/child')).toBe(false);
});
it('keeps loopback and strict port with exact external allowlist', () => {
 expect(devProxyConfig({})).toMatchObject({ host: '127.0.0.1', strictPort: true, allowedHosts: [] });
 expect(devProxyConfig({ DAMKA_DEV_ALLOWED_HOSTS: 'preview.example.com' }).allowedHosts).toEqual(['preview.example.com']);
 for (const host of ['', '*', 'true', '.example.com', 'https://example.com', 'a.example.com:123', 'a.example.com,', 'a..com']) expect(() => devProxyConfig({ DAMKA_DEV_ALLOWED_HOSTS: host })).toThrow();
 for (const port of ['', '0', '-1', '1.5', '65536', 'Infinity']) expect(() => devProxyConfig({ DAMKA_DEV_API_PORT: port })).toThrow();
});
