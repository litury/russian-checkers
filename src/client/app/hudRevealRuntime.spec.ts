import {afterEach, expect, it, vi} from 'vitest';
import type Phaser from 'phaser';
const panels = vi.hoisted(() => [] as any[]);
vi.mock('./bunkerPanel', () => ({createBunkerPanel: () => {
 const panel = {root:{setVisible:vi.fn()}, pose:vi.fn(), setClock:vi.fn(), setStatus:vi.fn(), setName:vi.fn(), layout:vi.fn()};
 panels.push(panel); return panel;
}}));
import {createHud} from './createHud';
import {preparationMs} from './panelReveal';
import {panelDurationMs} from './openingGates';
function setup(reduced=false) {
 const document = Object.assign(new EventTarget(), {hidden:false});
 const media = Object.assign(new EventTarget(), {matches:reduced});
 vi.stubGlobal('document',document); vi.stubGlobal('window',new EventTarget()); vi.stubGlobal('matchMedia',()=>media);
 const events = new Map<string,()=>void>();
 const scene = {time:{now:0},events:{on:(key:string,fn:()=>void)=>events.set(key,fn),off:vi.fn(),once:vi.fn()}};
 const hud=createHud(scene as unknown as Phaser.Scene);
 hud.prepareClosed(); hud.setVisible(true);
 return {hud,document,media,tick:(ms:number)=>{scene.time.now+=ms; events.get('update')!();}};
}
afterEach(()=>{panels.length=0;vi.unstubAllGlobals();});
it('starts closed and advances both panels synchronously before exactly one ready',()=>{
 const {hud,tick}=setup(); const done=vi.fn();hud.startReveal(done);
 expect(done).not.toHaveBeenCalled();
 for(const p of panels)expect(p.pose).toHaveBeenLastCalledWith(0,false);
 tick(panelDurationMs/2);
 for(const p of panels)expect(p.pose).toHaveBeenLastCalledWith(preparationMs/2,false);
 expect(done).not.toHaveBeenCalled();tick(panelDurationMs/2);tick(500);
 expect(done).toHaveBeenCalledTimes(1);
});
it('hidden time does not jump the local preparation and cancel cannot call ready',()=>{
 const {hud,tick,document}=setup();const done=vi.fn();hud.startReveal(done);
 tick(100);document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));tick(5000);
 document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));tick(100);
 expect(done).not.toHaveBeenCalled();hud.stopReveal();tick(5000);expect(done).not.toHaveBeenCalled();
});
it('reduced motion is direct final state',()=>{
 const {hud}=setup(true);const done=vi.fn();hud.startReveal(done);expect(done).toHaveBeenCalledTimes(1);
 for(const p of panels)expect(p.pose).toHaveBeenLastCalledWith(preparationMs,true);
});
it('authoritative online finish cancels preparation without stale local bank callback',()=>{
 const {hud,tick}=setup();const done=vi.fn();hud.startReveal(done);tick(100);hud.finishReveal();tick(5000);
 expect(done).not.toHaveBeenCalled();for(const p of panels)expect(p.pose).toHaveBeenLastCalledWith(preparationMs,false);
});
