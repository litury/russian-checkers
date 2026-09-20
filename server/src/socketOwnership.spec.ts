import { expect, it, vi } from 'vitest';
import ts from 'typescript';
import source from './index.ts?raw';

function harness() {
 const queue: any[] = [];
 const playerRoom = new Map([['p', 'r']]);
 const room = { socks: new Map<string, unknown>() };
 const rooms = new Map([['r', room]]);
 const dropPlayer = vi.fn();
 const bumpPresence = vi.fn();
 let close!: () => void;
 const sock = {};
 const server = { on: (_event: string, callback: Function) => callback({url:'/ws'}, {destroy: vi.fn()}) };
 const acceptWebsocket = (_req: unknown, _socket: unknown, _message: unknown, onClose: () => void) => { close = onClose; return sock; };
 const code = source.slice(source.indexOf("server.on('upgrade'"), source.indexOf("server.on('error'"))
  .replace('const ctx: {player?: string} = {};', "const ctx: {player?: string} = {player: 'p'};");
 const js = ts.transpileModule(code, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('server','acceptWebsocket','handleWs','queue','playerRoom','rooms','dropPlayer','bumpPresence',js)(server,acceptWebsocket,vi.fn(),queue,playerRoom,rooms,dropPlayer,bumpPresence);
 return {queue,room,sock,close,dropPlayer};
}

it('closing a replaced socket does not drop the reconnected player', () => {
 const h = harness();
 h.room.socks.set('p', {});
 h.close();
 expect(h.dropPlayer).not.toHaveBeenCalled();
});

it('closing an older socket preserves a newer queue entry', () => {
 const h = harness();
 const replacement = {id: 'p', sock: {}};
 h.queue.push(replacement);
 h.close();
 expect(h.queue).toEqual([replacement]);
});

it('closing the queue owner removes its entry', () => {
 const h = harness();
 h.queue.push({id: 'p', sock: h.sock});
 h.close();
 expect(h.queue).toEqual([]);
});

it('closing the current room socket still drops its player', () => {
 const h = harness();
 h.room.socks.set('p', h.sock);
 h.close();
 expect(h.dropPlayer).toHaveBeenCalledWith(h.room, 'p');
});
