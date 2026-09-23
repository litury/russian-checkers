export const HTTP_API_ROUTE = '^/(health|stats|presence|players|auth|matches)(/|\\?|$)';
export const WS_API_ROUTE = '^/ws(\\?|$)';

/** Exact host allowlist, not authentication. Local .env.local is ignored by git. */
export function devProxyConfig(env: Record<string, string | undefined>) {
 const raw = env.DAMKA_DEV_ALLOWED_HOSTS;
 const allowedHosts = raw === undefined ? [] : raw.split(',').map((host) => host.trim());
 if (allowedHosts.some((host) => host.length > 253 || !host.includes('.') ||
  !host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))) {
  throw new Error('DAMKA_DEV_ALLOWED_HOSTS must contain exact lowercase DNS hostnames, not URLs or wildcards');
 }
 const port = env.DAMKA_DEV_API_PORT ?? '8787';
 if (!/^[1-9][0-9]{0,4}$/.test(port) || Number(port) > 65535) throw new Error('Invalid DAMKA_DEV_API_PORT');
 return {
  host: '127.0.0.1', strictPort: true, allowedHosts,
  proxy: {
   [HTTP_API_ROUTE]: `http://127.0.0.1:${port}`,
   [WS_API_ROUTE]: { target: `ws://127.0.0.1:${port}`, ws: true },
  },
 };
}
