import { isIP } from 'node:net';
import type { AddressInfo } from 'node:net';

/** Preserve the container's all-interface default; local development sets HOST explicitly. */
export function bindHost(value: string | undefined) {
 const host = value ?? '::';
 if (!isIP(host) && host !== 'localhost') throw new Error('HOST must be an IP address or localhost');
 return host;
}
export function bindMessage(address: AddressInfo | string | null) {
 if (!address || typeof address === 'string') throw new Error('Expected TCP listening address');
 const host = address.family === 'IPv6' ? `[${address.address}]` : address.address;
 return `checkers-server bound http://${host}:${address.port} ws://${host}:${address.port}/ws`;
}
