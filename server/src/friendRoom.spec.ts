import { expect, it } from 'vitest';
import src from './index.ts?raw';
import live from '../../src/online/live.ts?raw';
import search from '../../src/client/app/matchmakingSearch.ts?raw';
import { searchCopy } from '../../src/client/app/matchmakingSearch';

it('hosts a friend room off the random queue', () => {
 expect(src).toContain("type === 'host'");
 expect(src).toContain("type === 'join'");
 expect(src).toContain('room.friend && !room.black');
 expect(src).toContain("openOnlineRoom(player, '', true)");
 expect(src).toContain('openOnlineRoom(a.id, b.id, false)');
 expect(live).toContain('host()');
 expect(live).toContain('join(matchId');
 expect(searchCopy('friend-wait', 0).title).toBe('Ждём друга');
 expect(searchCopy('friend-wait', 0, '/?join=abc').title).toContain('/?join=');
 expect(searchCopy('friend-wait', 0).showBot).toBe(false);
 expect(searchCopy('timeout-offer', 0).showBot).toBe(true);
 expect(search).toContain('friend-wait');
});
