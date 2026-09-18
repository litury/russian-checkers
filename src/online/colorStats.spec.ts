import { expect, it } from 'vitest';
import { colorStatLabel, colorStatsSql } from './colorStats';
import src from '../../server/src/index.ts?raw';
import overlay from '../client/app/openingOverlay.ts?raw';
import html from '../../index.html?raw';

it('counts every decisive online game, no ply floor', () => {
 expect(colorStatsSql).toContain("mode = 'online'");
 expect(colorStatsSql).toContain("winner IN ('white', 'black')");
 expect(colorStatsSql).not.toContain('match_plies');
 expect(src).toContain('/stats/colors');
 expect(colorStatLabel(null, 'white')).toBe('');
 expect(colorStatLabel({ white: 0, black: 0, games: 0 }, 'white')).toBe('0');
 expect(colorStatLabel({ white: 1, black: 0, games: 1 }, 'white')).toBe('1');
 expect(overlay).toContain('loadColorStats');
 expect(html).toContain('opening-color-white');
 expect(html).toContain('opening-color-black');
});
