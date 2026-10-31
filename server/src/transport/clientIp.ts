import { BlockList, isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';

function normalizeIp(_address: string): string {
	const address = _address.trim().toLowerCase();
	return address.startsWith('::ffff:') && isIP(address.slice(7)) === 4
		? address.slice(7)
		: address;
}

export function createClientIp(_trustedCidrs: string) {
	const trusted = new BlockList();
	for (const entry of _trustedCidrs.split(',').map(value => value.trim()).filter(Boolean)) {
		const parts = entry.split('/');
		const address = normalizeIp(parts[0]);
		const family = isIP(address);
		if (!family || parts.length > 2 || (parts.length === 2 && !/^\d+$/.test(parts[1])))
			throw new Error('Invalid TRUSTED_PROXY_CIDRS');
		const type = family === 4 ? 'ipv4' : 'ipv6';
		if (parts.length === 1) trusted.addAddress(address, type);
		else trusted.addSubnet(address, Number(parts[1]), type);
	}
	const isTrusted = (_address: string) =>
		trusted.check(_address, isIP(_address) === 4 ? 'ipv4' : 'ipv6');
	return (_request: IncomingMessage): string => {
		const remote = normalizeIp(_request.socket.remoteAddress ?? '');
		if (!isIP(remote) || !isTrusted(remote)) return remote;
		const header = _request.headers['x-forwarded-for'];
		if (typeof header !== 'string') return remote;
		const chain = header.split(',').map(normalizeIp);
		if (chain.length > 16 || chain.some(address => !isIP(address))) return remote;
		chain.push(remote);
		let index = chain.length - 1;
		while (index > 0 && isTrusted(chain[index])) index--;
		return chain[index];
	};
}
