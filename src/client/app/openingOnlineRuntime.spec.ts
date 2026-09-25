import {afterEach,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
import {GameScene} from './gameScene';
function setup(){
 const s=new GameScene() as any;
 s.countingIn=true;s.online=true;s.humanSide='white';s.time={now:5000};
 s.title={hide:vi.fn(),beginMatch:vi.fn()};
 s.hud={stopReveal:vi.fn(),finishReveal:vi.fn()};s.board={clearOpeningHint:vi.fn()};
 s.paintClock=vi.fn();s.refresh=vi.fn();s.drainInbound=vi.fn();
 const snap={begun:true,ply:0,turn:'white',pieces:[],clocks:{banks:{white:60000,black:60000},serverNow:10000,turnStarted:9700,paused:false}};
 return {s,snap};
}
afterEach(()=>vi.restoreAllMocks());
it.each(['applyBegin','applyState'])('%s interrupts decoration and preserves server elapsed time',method=>{
 const {s,snap}=setup();s[method](snap);
 expect(s.countingIn).toBe(false);expect(s.title.hide).toHaveBeenCalledWith(true);
 expect(s.hud.finishReveal).toHaveBeenCalledTimes(1);expect(s.clockStartedAt).toBe(4700);
 s[method](snap);expect(s.hud.finishReveal).toHaveBeenCalledTimes(1);
});
it('resume of a begun game closes decoration once, without replay',()=>{
 const {s,snap}=setup();s.applyResume('black',snap);s.applyResume('black',snap);
 expect(s.countingIn).toBe(false);expect(s.hud.finishReveal).toHaveBeenCalledTimes(1);expect(s.clockStartedAt).toBe(4700);
});
it('local input and banks open at the title callback, not at the reveal end',()=>{
 const {s}=setup();s.online=false;s.phase='human';s.board.startOpeningHint=vi.fn();
 s.title.depart=vi.fn();s.title.hintWave=vi.fn();s.title.speakOrcTurn=vi.fn();
 s.hud.setVisible=vi.fn();s.hud.startReveal=vi.fn();
 s.beginCountdown(true);expect(s.hud.startReveal).not.toHaveBeenCalled();expect(s.countingIn).toBe(true);
 s.title.depart.mock.calls[0][0]();
 expect(s.hud.startReveal).toHaveBeenCalledTimes(1);
 // Board is on screen: the match is already playable while panels keep sliding.
 expect(s.countingIn).toBe(false);expect(s.clockStartedAt).toBe(5000);
 s.hud.startReveal.mock.calls[0][0]();
 expect(s.countingIn).toBe(false);expect(s.clockStartedAt).toBe(5000);
 expect(s.hud.startReveal).toHaveBeenCalledTimes(1);
});
