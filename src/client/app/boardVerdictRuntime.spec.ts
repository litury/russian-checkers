import { afterEach, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('@/online/cloud', () => ({ recordBotMatch: vi.fn(), probeApi: vi.fn() }));
vi.mock('./settings', () => ({ getAutoMove: () => false, getBotSkill: () => 'normal' }));
import { GameScene } from './gameScene';
import { createInitialPosition } from '@/rules';
import { recordBotMatch } from '@/online/cloud';
import { verdictReason } from './verdictReason';
import { hashPosition } from '@/online/matchState';

function setup() {
 const s = new GameScene() as any;
 s.phase='human';s.position=createInitialPosition();s.clockStartedAt=1000;
 s.time={now:2000};s.hud={setTurn:vi.fn(),setClock:vi.fn(),stopReveal:vi.fn()};
 s.board={reset:vi.fn(),sync:vi.fn(),clearOpeningHint:vi.fn(),setWaitingIdle:vi.fn(),notePly:vi.fn()};
 s.overlay={show:vi.fn(),hide:vi.fn()};s.ensureResultOverlay=async()=>s.overlay;
 s.title={resultSting:vi.fn(),speakOrcTurn:vi.fn(),turnHandoff:vi.fn()};
 s.live={requestState:vi.fn()};return s;
}
afterEach(()=>vi.clearAllMocks());
it('duplicate outcome latches clocks, sound, history and panel only once',async()=>{
 const s=setup();s.endMatch('black','resign');s.endMatch('white','flag');await Promise.resolve();
 expect(s.clocks.white).toBe(59000);s.time.now+=8000;s.tickClock();expect(s.sideRemainingMs('white')).toBe(59000);
 expect(s.title.resultSting).toHaveBeenCalledOnce();expect(recordBotMatch).toHaveBeenCalledOnce();expect(s.overlay.show).toHaveBeenCalledOnce();
 expect(s.overlay.show.mock.calls[0][0].reason).toBe('Вы сдались');expect(s.canSelect()).toBe(false);
});
it('server outcome freezes immediately without cutting the last remote animation',async()=>{
 const s=setup();s.online=true;s.onlineBegun=true;s.serverTurn='black';s.phase='bot';s.position.turn='black';
 let done=()=>{};s.board.playMove=vi.fn((_m,cb)=>done=cb);
 const move={from:{row:5,col:1},path:[{row:4,col:0}]};
 s.playRemote(move);s.endMatch('white','resign');
 expect(s.phase).toBe('over');expect(s.board.reset).not.toHaveBeenCalled();expect(s.overlay.show).not.toHaveBeenCalled();
 s.refresh();expect(s.board.sync).not.toHaveBeenCalled();
 done();await Promise.resolve();expect(s.position.squares[4][0]?.side).toBe('black');
 expect(s.phase).toBe('over');expect(s.overlay.show).toHaveBeenCalledOnce();expect(s.title.turnHandoff).not.toHaveBeenCalled();
 expect(recordBotMatch).not.toHaveBeenCalled();
});
it('online local rules result is not authority: wait for server end',()=>{
 const s=setup();s.online=true;s.onlineBegun=true;s.applyingNet=true;s.serverTurn='black';
 s.position.squares=Array.from({length:8},()=>Array(8).fill(null));
 s.position.squares[5][1]={side:'white',kind:'man'};s.position.squares[6][2]={side:'black',kind:'man'};
 s.completeHumanMove({from:{row:5,col:1},path:[{row:7,col:3}]});
 expect(s.position.squares[7][3]?.kind).toBe('king');expect(s.acceptedResult).toBeNull();
 s.endMatch('white','rules');expect(s.acceptedResult.reason).toBe('У соперника не осталось шашек');
});
it('resignation during bot motion cannot revive phase on completion',async()=>{
 const s=setup();s.phase='bot';s.position.turn='black';let done=()=>{};
 s.board.playMove=vi.fn((_m,cb)=>done=cb);s.playBot();s.resignMatch();done();await Promise.resolve();
 expect(s.phase).toBe('over');expect(s.overlay.show).toHaveBeenCalledOnce();expect(s.title.turnHandoff).not.toHaveBeenCalled();
});
it('late animation from a previous match cannot mutate the new one',()=>{
 const s=setup();let done=()=>{};s.board.playMove=vi.fn((_m,cb)=>done=cb);
 const after=vi.fn();s.animateMove({from:{row:2,col:0},path:[{row:3,col:1}]},after);
 s.resultGen++;done();expect(after).not.toHaveBeenCalled();
});
it('drains contiguous final plies before considering a gap',()=>{
 const s=setup();s.online=true;s.lastPly=0;
 s.inboundNet=[{ply:1,side:'black',turn:'white'},{ply:2,side:'white',turn:'black'}];
 s.playRemote=vi.fn();s.drainInbound();
 expect(s.playRemote).toHaveBeenCalledOnce();expect(s.live.requestState).not.toHaveBeenCalled();
});
it('confirmed outcome never waits on a missing-ply state request',async()=>{
 const s=setup();s.online=true;s.inboundNet=[{ply:3}];
 s.endMatch('white','rules');await Promise.resolve();
 expect(s.live.requestState).not.toHaveBeenCalled();expect(s.overlay.show).toHaveBeenCalledOnce();
 expect(s.overlay.show.mock.calls[0][0].reason).toBe('Партия завершена');
});
it('an unacknowledged local online move cannot enter the final position',async()=>{
 const s=setup();s.online=true;s.onlineBegun=true;s.live.move=vi.fn();
 let done=()=>{};s.board.playMove=vi.fn((_m,cb)=>done=cb);
 const before=structuredClone(s.position);
 s.playHuman({from:{row:2,col:0},path:[{row:3,col:1}]});s.endMatch('black','resign');done();
 await Promise.resolve();expect(s.position).toEqual(before);expect(s.live.move).not.toHaveBeenCalled();
 expect(s.overlay.show).toHaveBeenCalledOnce();
});
it.each(['applyBegin','applyState','applyResume'])('terminal state ignores late %s',method=>{
 const s=setup();s.endMatch('white','timeout');const p=structuredClone(s.position);
 if(method==='applyResume')s[method]('black',{});else s[method]({});
 expect(s.phase).toBe('over');expect(s.position).toEqual(p);
});
it('draw and disconnect reasons never fabricate victory',()=>{
 const p=createInitialPosition();const key=hashPosition(p);
 expect(verdictReason('draw','white','rules',p,[key,key,key])).toBe('Позиция повторилась трижды');
 expect(verdictReason('draw','white','timeout',p,[])).toBe('Игроки не вернулись в партию');
 expect(verdictReason('white','black','timeout',p,[])).toBe('Вы не вернулись в партию');
 expect(verdictReason('white','white','flag',p,[])).toBe('У соперника закончилось время');
 expect(verdictReason('black','white','unknown',p,[])).toBe('Партия завершена');
});
