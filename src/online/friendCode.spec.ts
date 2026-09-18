import { expect, it } from 'vitest';
import { mintFriendCode, resolveFriendJoin } from './friendCode';
import src from '../../server/src/index.ts?raw';

it('mints 6-digit codes and resolves join without uuid in the map', () => {
 const taken = new Set<string>(['000000']);
 let n = 0;
 const rnd = () => {
  n += 1;
  return n === 1 ? 0 : 0.123456;
 };
 const code = mintFriendCode(taken, rnd);
 expect(code).toMatch(/^\d{6}$/);
 expect(code).not.toBe('000000');
 const codes = new Map([[code, 'room-a']]);
 expect(resolveFriendJoin(code, codes)).toBe('room-a');
 expect(resolveFriendJoin('nope', codes)).toBe('nope');
 expect(src).toContain('mintFriendCode');
 expect(src).toContain('hosted');
 expect(src).toContain('code');
});
