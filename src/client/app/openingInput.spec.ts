import {afterEach,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
import {GameScene} from './gameScene';
function setup(){
 const s=new GameScene() as any;
 s.online=false;s.humanSide='white';s.phase='human';
 s.time={now:5000,delayedCall:vi.fn(()=>({remove:vi.fn()}))};
 s.title={hide:vi.fn(),show:vi.fn(),beginMatch:vi.fn(),speakOrcTurn:vi.fn(),hintWave:vi.fn()};
 s.hud={stopReveal:vi.fn(),finishReveal:vi.fn(),setVisible:vi.fn(),prepareClosed:vi.fn(),setNames:vi.fn(),setFacing:vi.fn(),setClock:vi.fn(),startReveal:vi.fn()};
 s.board={clearOpeningHint:vi.fn(),startOpeningHint:vi.fn(),reset:vi.fn(),setFacing:vi.fn(),setPlayfieldVisible:vi.fn()};
 s.paintClock=vi.fn();s.refresh=vi.fn();s.tweens={killAll:vi.fn()};
 s.botTimer={remove:vi.fn()};
 return s;
}
afterEach(()=>vi.restoreAllMocks());
it('a board already on screen releases input and banks while panels keep revealing',()=>{
 const s=setup();
 s.beginCountdown(false);
 expect(s.countingIn).toBe(false);
 expect(s.clockStartedAt).toBe(5000);
 expect(s.hud.startReveal).toHaveBeenCalledTimes(1);
 // Decorative completion later owns nothing and cannot restart the bank clock.
 s.hud.startReveal.mock.calls[0][0]();
 expect(s.countingIn).toBe(false);
 expect(s.clockStartedAt).toBe(5000);
 expect(s.hud.startReveal).toHaveBeenCalledTimes(1);
});
it('the black side gets its bot move at the board release, not after the reveal',()=>{
 const s=setup();
 s.phase='bot';s.humanSide='black';
 s.beginCountdown(false);
 expect(s.countingIn).toBe(false);
 expect(s.time.delayedCall).toHaveBeenCalledWith(400,expect.any(Function));
});
it('an online seat still waits for the server, not for the local reveal',()=>{
 const s=setup();
 s.online=true;s.phase='human';s.onlineBegun=false;s.serverTurn='black';
 s.live={ready:vi.fn(),requestState:vi.fn()};
 s.beginCountdown(false);
 expect(s.live.ready).toHaveBeenCalledTimes(1);
 expect(s.countingIn).toBe(true);
 expect(s.clockStartedAt).toBe(0);
 s.hud.startReveal.mock.calls[0][0]();
 expect(s.countingIn).toBe(true);
 expect(s.live.ready).toHaveBeenCalledTimes(1);
});
