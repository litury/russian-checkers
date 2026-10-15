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
 expect(html).toContain('aria-label="Профиль"');
 expect(html).toContain('id="profile-identity"');
 expect(html).toContain('История партий');
 expect(html).toContain('id="opening-history"');
 expect(ui).toContain('Пока нет партий');
 // Scope to the dialog element: aria-controls on the sibling Settings button is not its contents.
 const settingsDialog = html.match(/<dialog\b[^>]*id="opening-settings-dialog"[^>]*>[\s\S]*?<\/dialog>/)?.[0];
 expect(settingsDialog).toBeDefined();
 expect(settingsDialog).not.toContain('id="opening-history"');
 expect(settingsDialog).not.toContain('email');
 expect(settingsDialog).not.toContain('profile-stats');
 expect(overlay).toContain('bindMatchHistory');
 expect(ui).not.toContain('pickBotMove');
 expect(ui).not.toContain('Пример разбора');
 expect(ui).toContain('Смотреть');
 expect(ui).toContain('Загрузка…');
 expect(ui).toContain('Не удалось загрузить партии');
 expect(ui).toContain("result === null");
 expect(ui).toContain('title.inert');
 expect(settings).not.toContain('match-history');
});

it('keeps rules on the root and separates account, history and replay', () => {
 const profile = html.match(/<dialog\b[^>]*id="match-history"[^>]*>[\s\S]*?<\/dialog>/)?.[0];
 expect(profile).toContain('id="profile-rules"');
 expect(profile).toContain('aria-controls="opening-help-dialog"');
 expect(html.match(/id="opening-help-dialog"/g)).toHaveLength(1);
 expect(html).toContain('window.checkersRules = { open:');
 expect(ui).toContain('checkersRules?.open()');
 expect(ui).toContain("showPane('root')");
 expect(ui).toContain("showPane('list')");
 expect(ui).toContain("showPane('record')");
 expect(ui).toContain("showPane('account')");
 expect(ui).toContain("el('match-history-profile').hidden = next !== 'root'");
 expect(profile).toContain('id="profile-history"');
 expect(profile).toContain('id="profile-account"');
 expect(profile).toContain('id="profile-account-pane"');
 expect(profile).not.toContain('Профиль этого браузера');
});
