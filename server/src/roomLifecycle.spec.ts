import { afterEach, expect, it, vi } from 'vitest';
import ts from 'typescript';
import source from './index.ts?raw';
import { turnLeft, flagDue, flagWinner } from './flagClock';
import { createInitialPosition } from '../../src/rules';

// Execute the real lifecycle functions/WS branches, without starting HTTP or a DB.
function harness() {
 vi.useFakeTimers(); vi.setSystemTime(10000);
 const room: any = { id:'room', white:'player-white', black:'player-black', begun:true,
  position:createInitialPosition(), banks:{white:60000,black:60000}, turnStarted:1000,
  drop:new Map(), socks:new Map(), ply:0, keys:[] };
 const rooms=new Map([[room.id,room]]);
 const endRoom=vi.fn(); const send=vi.fn();
 const functions=source.slice(source.indexOf('const otherOf ='),source.indexOf('const openOnlineRoom ='));
 const branches=source.slice(source.indexOf(" if (msg.type === 'move')"),source.indexOf('\n};\n\nawait runMigrations'));
 const code=ts.transpileModule(functions+`\nasync function dispatch(msg,player){const sock={};${branches}\n}\nreturn {attach,dropPlayer,armFlag,dispatch};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const api=new Function('rooms','endRoom','send','bumpPresence','snapshotOf','turnLeft','flagDue','flagWinner','DROP_MS','READY_MS','blitzStartMs','playerRoom','applyPly',code)(
  rooms,endRoom,send,()=>{},()=>({}),turnLeft,flagDue,flagWinner,60000,25000,60000,
  new Map([[room.white,room.id],[room.black,room.id]]),()=>{throw Error('move must not reach rules during drop');});
 return {room,endRoom,send,...api};
}
afterEach(()=>vi.useRealTimers());
it('drop settles elapsed bank once; only final reattach resumes',()=>{
 const h=harness(); h.dropPlayer(h.room,h.room.white);
 expect(h.room.banks.white).toBe(51000);
 vi.setSystemTime(20000); h.dropPlayer(h.room,h.room.black);
 expect(h.room.banks.white).toBe(51000);
 h.attach(h.room,h.room.white,{}); expect(h.room.drop.size).toBe(1);
 vi.setSystemTime(30000); h.attach(h.room,h.room.black,{});
 expect(h.room.turnStarted).toBe(30000); expect(h.room.banks.white).toBe(51000);
});
it('attach without drop never refunds elapsed turn time',()=>{
 const h=harness(); h.attach(h.room,h.room.white,{});
 expect(h.room.turnStarted).toBe(1000);
});
it('move and flag cannot end or mutate a paused grace room',async()=>{
 const h=harness(); h.dropPlayer(h.room,h.room.black); vi.setSystemTime(80000);
 await h.dispatch({type:'flag'},h.room.white);
 await h.dispatch({type:'move',from:'c3',path:['d4']},h.room.white);
 expect(h.endRoom).not.toHaveBeenCalled(); expect(h.room.ply).toBe(0);
});
it.each(['player-white','player-black'])('resignation %s reports a Side not playerId',async player=>{
 const h=harness(); await h.dispatch({type:'resign'},player);
 expect(h.endRoom).toHaveBeenCalledWith(h.room,player==='player-white'?'black':'white','resign',player);
});
it('resumed flag fires only after the remaining bank',()=>{
 const h=harness(); h.dropPlayer(h.room,h.room.black);
 vi.advanceTimersByTime(20000); expect(h.endRoom).not.toHaveBeenCalled();
 h.attach(h.room,h.room.black,{});
 vi.advanceTimersByTime(50999); expect(h.endRoom).not.toHaveBeenCalled();
 vi.advanceTimersByTime(1);
 expect(h.endRoom).toHaveBeenCalledWith(h.room,'black','flag',h.room.white);
});
it('move during grace with time left is rejected before rules',async()=>{
 const h=harness(); h.dropPlayer(h.room,h.room.black);
 await h.dispatch({type:'move',from:'c3',path:['d4']},h.room.white);
 expect(h.send).toHaveBeenCalledWith({}, {type:'error',error:'illegal'});
 expect(h.room.ply).toBe(0); expect(h.endRoom).not.toHaveBeenCalled();
});
it('drop expiry reports the opponent color',()=>{
 const h=harness(); h.dropPlayer(h.room,h.room.white); vi.advanceTimersByTime(60000);
 expect(h.endRoom).toHaveBeenCalledWith(h.room,'black','timeout',h.room.white);
});
