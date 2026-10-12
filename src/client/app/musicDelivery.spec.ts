import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { matchMusicLevel, menuOrganLevel } from './audioMix';
import { matchMusicCompensation, menuMusicCompensation } from './musicDelivery';

const provenance = JSON.parse(
	readFileSync(
		new URL('../../../docs/music-loops/provenance.json', import.meta.url),
		'utf8',
	),
);

it.each([
	['menu', 'menu_music_source', menuMusicCompensation],
	['match', 'match-b-90s', matchMusicCompensation],
] as const)(
	'pins %s delivery bytes and its independent level match',
	(name, file, compensation) => {
		const bytes = readFileSync(
			new URL(`./audio/menu/${file}.mp3`, import.meta.url),
		);
		const track = provenance.tracks[name];
		expect(bytes.length).toBe(track.bytes);
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(track.sha256);
		expect(compensation).toBe(track.runtime_level_compensation);
		const effective =
			Number(track.delivery_loudness.input_i) + 20 * Math.log10(compensation);
		expect(effective).toBeCloseTo(track.reference_lufs, 6);
		expect(track.beats).toBe(32);
	},
);

it('preserves menu vs match hierarchy after delivery compensation', () => {
	expect(matchMusicLevel * matchMusicCompensation).toBeLessThan(
		menuOrganLevel * menuMusicCompensation,
	);
	expect(menuOrganLevel * menuMusicCompensation).toBeLessThan(1);
});
