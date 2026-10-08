import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import css from './openingGates.css?raw';
import warmup from './searchArtWarmup.ts?raw';

const root = new URL('./ui/siege/', import.meta.url);
const states = ['rest', 'hover', 'pressed', 'focus', 'disabled'];
it('records verifiable provenance for every generated runtime export', () => {
	const manifest = JSON.parse(
		readFileSync(new URL('search-art-provenance.json', root), 'utf8'),
	);
	expect(manifest.files).toHaveLength(8);
	for (const file of manifest.files) {
		const bytes = readFileSync(new URL(file.file, root));
		expect(bytes.byteLength).toBe(file.bytes);
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
		expect(bytes.toString('ascii', 12, 16)).toBe('VP8L');
	}
});
it('uses exactly five lossless DPR2 nine-slice states, preserving native alpha and distinct pixels', () => {
	const names = readdirSync(root).filter((name) =>
		/^search-button-.*\.webp$/.test(name),
	);
	expect(names.sort()).toEqual(
		states.map((state) => `search-button-${state}.webp`).sort(),
	);
	const hashes = new Set<string>();
	for (const name of names) {
		const bytes = readFileSync(new URL(name, root));
		expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
		expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
		expect(bytes.toString('ascii', 12, 16)).toBe('VP8L');
		expect(bytes[20]).toBe(0x2f);
		const bits = bytes.readUInt32LE(21);
		expect((bits & 0x3fff) + 1).toBe(196);
		expect(((bits >>> 14) & 0x3fff) + 1).toBe(140);
		expect((bits >>> 28) & 1).toBe(1);
		hashes.add(createHash('sha256').update(bytes).digest('hex'));
		expect(css).toContain(name);
	}
	expect(hashes.size).toBe(5);
	expect(css).toContain('40 48 fill / 20px 24px / 0 stretch');
	expect(css).not.toContain('button-steel-search-');
});
it('uses generated panel artwork and reserved single-line grooves rather than a painted gate background', () => {
	const before = css.match(/#opening-search::before \{([^}]+)\}/)?.[1];
	expect(before).toContain('search-body.webp');
	expect(before).not.toMatch(/linear-gradient|gate\.webp|box-shadow/);
	expect(css).toContain('aspect-ratio:860/134');
	expect(css).toContain('inset:28% 12% 35%');
	expect(css).toContain("url('./ui/siege/search-count.webp')");
	expect(css).toContain('white-space:nowrap');
});
it('warms only the five current states and three generated panel exports without blocking gameplay', () => {
	expect(warmup).toContain('./ui/siege/search-button-*.webp');
	for (const name of ['header', 'body', 'count'])
		expect(warmup).toContain(`./ui/siege/search-${name}.webp`);
	expect(warmup).not.toMatch(/\.png|button-steel-search-|disabled\s*=/);
	expect(warmup).toMatch(
		/catch\s*\{\s*\/\* Decoration failure is nonfatal\. \*\/\s*\}/,
	);
});
