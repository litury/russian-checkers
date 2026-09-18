import { expect, it } from 'vitest';
import { canOpenBoard, ownColor } from './matchHistory';
import src from '../../server/src/index.ts?raw';
import html from '../../index.html?raw';
import overlay from '../client/app/openingOverlay.ts?raw';
import ui from '../client/app/matchHistoryUi.ts?raw';
import settings from '../client/app/settings.ts?raw';

it('lists own matches outside settings, board only with plies', () => {
 expect(ownColor('a', 'b', 'a')).toBe('white');
 expect(ownColor('a', 'b', 'b')).toBe('black');
 expect(ownColor('a', 'b', 'c')).toBe(null);
 expect(canOpenBoard({ plies: 0 })).toBe(false);
 expect(canOpenBoard({ plies: 3 })).toBe(true);
 expect(src).toContain("path === '/matches'");
 expect(src).toContain("path.startsWith('/matches/')");
 expect(src).toContain('not_found');
 expect(html).toContain('Партии');
 expect(html).toContain('id="opening-history"');
 expect(html).toContain('Пока нет партий');
 expect(html).not.toMatch(/opening-settings-dialog[\s\S]{0,800}opening-history/);
 expect(overlay).toContain('bindMatchHistory');
 expect(ui).toContain('title.inert');
 expect(settings).not.toContain('match-history');
});
