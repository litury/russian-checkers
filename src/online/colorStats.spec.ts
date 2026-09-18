import { expect, it } from 'vitest';
import { COLOR_STATS_MIN_PLY, colorStatLabel, colorStatsSql } from './colorStats';
import src from '../../server/src/index.ts?raw';
import overlay from '../client/app/openingOverlay.ts?raw';
import html from '../../index.html?raw';

it('counts online decisive games with ply floor, shows small samples', () => {
 expect(COLOR_STATS_MIN_PLY).toBe(6);
 expect(colorStatsSql).toContain("mode = 'online'");
 expect(colorStatsSql).toContain("winner IN ('white', 'black')");
 expect(src).toContain('/stats/colors');
 expect(colorStatLabel(null, 'white')).toBe('');
 expect(colorStatLabel({ white: 0, black: 0, games: 0 }, 'white')).toBe('0');
 expect(colorStatLabel({ white: 0, black: 0, games: 0 }, 'black')).toBe('0');
 expect(colorStatLabel({ white: 1, black: 0, games: 1 }, 'white')).toBe('1');
 expect(colorStatLabel({ white: 1, black: 0, games: 1 }, 'black')).toBe('0');
 expect(overlay).toContain('loadColorStats');
 expect(html).toContain('opening-color-white');
 expect(html).toContain('opening-color-black');
 expect(html).not.toMatch(/id="opening-play"[^>]*opening-color/);
});
