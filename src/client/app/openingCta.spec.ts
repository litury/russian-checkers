import { expect, it } from 'vitest';
import html from '../../../index.html?raw';
import overlay from './openingOverlay.ts?raw';
import scene from './gameScene.ts?raw';
import { searchCopy } from './matchmakingSearch';
import { guestTag } from '../../online/guestTag';
import { canOpenBoard } from '../../online/matchHistory';
import ui from './matchHistoryUi.ts?raw';

it('two equal CTAs: С машиной and С человеком; friend lives in online hub', () => {
 expect(html).toContain('С человеком');
 expect(html).not.toContain('id="opening-friend"');
 expect(html).toContain('id="opening-search-find"');
 expect(html).toContain('Найти');
 expect(html).toContain('Создать');
 expect(html).toContain('Ввести код');
 expect(html).toContain('id="opening-settings"');
 expect(html).toContain('id="opening-history"');
 expect(html).toContain('id="opening-help"');
 expect(overlay).toContain('opening-search-find');
 expect(scene).toContain("beginSearchUi('online-hub')");
 expect(searchCopy('online-hub', 0).showFind).toBe(true);
 expect(searchCopy('online-hub', 0).showCreate).toBe(true);
 expect(searchCopy('online-hub', 0).showEnter).toBe(true);
});

it('guest tag is 4 hex, empty matches stay closed', () => {
 expect(guestTag('a3f2c91d-1111-4000-8000-aaaaaaaaaaaa')).toBe('· a3f2');
 expect(guestTag('')).toBe('');
 expect(canOpenBoard({ plies: 0 })).toBe(false);
 expect(ui).toContain('обрыв');
});
