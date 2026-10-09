import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import manifest from './ui/verdict/manifest.json';

const directory = new URL('./ui/verdict/', import.meta.url);
const css = readFileSync(
	new URL('./boardVerdict.css', import.meta.url),
	'utf8',
);
const states = ['rest', 'hover', 'pressed', 'disabled'];
const names = [
	'title',
	...['primary', 'secondary', 'quiet'].flatMap((tier) =>
		states.map((state) => `${tier}-${state}`),
	),
];

it('delivers exactly the title and twelve distinct native lossless plates', () => {
	expect(manifest.map((asset) => asset.name)).toEqual(names);
	expect(readdirSync(directory).sort()).toEqual(
		['manifest.json', ...names.map((name) => `${name}.webp`)].sort(),
	);
	const hashes = new Set<string>();
	for (const asset of manifest) {
		const bytes = readFileSync(new URL(`${asset.name}.webp`, directory));
		expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
		expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
		// VP8L is the lossless bitstream; dimensions come from its packed header.
		const offset = bytes.indexOf(Buffer.from('VP8L'));
		expect(offset).toBeGreaterThanOrEqual(12);
		expect(bytes[offset + 8]).toBe(0x2f);
		const header = bytes.readUInt32LE(offset + 9);
		expect([(header & 0x3fff) + 1, ((header >>> 14) & 0x3fff) + 1]).toEqual(
			asset.size,
		);
		expect((header >>> 28) & 1).toBe(1); // Native alpha is present.
		const hash = createHash('sha256').update(bytes).digest('hex');
		expect(hash).toBe(asset.sha256);
		hashes.add(hash);
		expect(css).toContain(`${asset.name}.webp`);
		expect(asset.dpr).toBe(3);
		expect(asset.slice).toEqual(
			asset.name === 'title' ? [400, 330, 300, 330] : [30, 105, 30, 105],
		);
		expect(asset.slice[1] + asset.slice[3]).toBeLessThan(asset.size[0]);
		expect(asset.slice[0] + asset.slice[2]).toBeLessThan(asset.size[1]);
	}
	expect(hashes.size).toBe(13);
});
it('uses fixed DPR3 nine-slice corners, unified materials and accessible controls', () => {
	expect(css).toMatch(/30 105 30 105 fill\s*\/\s*10px 35px\s*\/\s*0\s+stretch/);
	expect(css).toMatch(/400 330 300 330 fill/);
	expect(css).not.toMatch(/gradient|filter\s*:|frame-(win|loss|draw)|48 fill/);
	expect(css).not.toContain('box-shadow: 0');
	expect(css).toContain('min-height: 44px');
	expect(css).toContain('min-height: 64px');
	expect(css).toMatch(/\.verdict-actions button\s*\{\s*width: 100%/);
	expect(css).toMatch(
		/\.verdict-actions \[data-verdict="menu"\]\s*\{\s*width: 100%/,
	);
	expect(css).toContain(':focus-visible');
	expect(css).toContain('prefers-reduced-motion');
	for (const [action, tier] of [
		['again', 'primary'],
		['menu', 'quiet'],
	]) {
		for (const state of states.slice(1)) {
			const pseudo = state === 'pressed' ? 'active' : state;
			expect(css).toMatch(
				new RegExp(
					`\\[data-verdict="${action}"\\]:${pseudo}\\s*\\{[^}]*${tier}-${state}\\.webp`,
				),
			);
		}
	}
});
