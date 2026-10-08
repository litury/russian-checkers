import { afterEach, expect, it, vi } from 'vitest';
import { bindResignConfirmation } from './resignConfirmation';
function setup(art?: {ready:()=>boolean;prepare:()=>Promise<boolean>}) {
 const doc={activeElement:null as unknown,getElementById:(id:string)=>nodes[id]};
 const button=()=>Object.assign(new EventTarget(),{disabled:false,hidden:false,setAttribute(){},removeAttribute(){},focus(){doc.activeElement=this;}});
 const trigger=button(),resume=button(),accept=button();
 const dialog=Object.assign(new EventTarget(),{open:false,showModal(){this.open=true;},close(){this.open=false;this.dispatchEvent(new Event('close'));}});
 const nodes:Record<string,unknown>={'resign-confirmation':dialog,'resign-continue':resume,'resign-confirm':accept};
 vi.stubGlobal('document',doc);const confirm=vi.fn();let available=true;
 const binding=bindResignConfirmation(trigger as any,confirm,()=>available,art)!;
 return {doc,trigger,resume,accept,dialog,confirm,binding,unavailable:()=>{available=false;}};
}
const click=(el:EventTarget)=>el.dispatchEvent(new Event('click'));
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('never reveals incomplete art; caps waiting at500ms and rejects late completion',async()=>{
 vi.useFakeTimers();let resolve!:(ready:boolean)=>void;
 const t=setup({ready:()=>false,prepare:()=>new Promise(r=>{resolve=r;})});
 click(t.trigger);expect(t.dialog.open).toBe(false);
 await vi.advanceTimersByTimeAsync(500);resolve(true);await vi.advanceTimersByTimeAsync(0);
 expect(t.dialog.open).toBe(false);expect(t.confirm).not.toHaveBeenCalled();
});
it('reveals only decoded art and ignores completion after destroy',async()=>{
 const t=setup({ready:()=>false,prepare:()=>Promise.resolve(true)});click(t.trigger);
 await new Promise(r=>setTimeout(r,0));expect(t.dialog.open).toBe(true);
 let resolve!:(ready:boolean)=>void;const u=setup({ready:()=>false,prepare:()=>new Promise(r=>{resolve=r;})});
 click(u.trigger);u.binding.destroy();resolve(true);await new Promise(r=>setTimeout(r,0));expect(u.dialog.open).toBe(false);
});
it('opens once on Continue and dismisses without committing, restoring trigger focus',()=>{
 const t=setup();click(t.trigger);expect(t.dialog.open).toBe(true);expect(t.doc.activeElement).toBe(t.resume);
 click(t.resume);expect(t.dialog.open).toBe(false);expect(t.confirm).not.toHaveBeenCalled();expect(t.doc.activeElement).toBe(t.trigger);
});
it('confirms once and rejects stale/unavailable confirmation',()=>{
 const t=setup();click(t.trigger);click(t.accept);click(t.accept);expect(t.confirm).toHaveBeenCalledOnce();
 click(t.trigger);t.unavailable();click(t.accept);expect(t.confirm).toHaveBeenCalledOnce();expect(t.dialog.open).toBe(false);
});
it('disabled, unavailable and destroyed triggers cannot open the dialog',()=>{
 const t=setup();t.trigger.disabled=true;click(t.trigger);expect(t.dialog.open).toBe(false);
 t.trigger.disabled=false;t.unavailable();click(t.trigger);expect(t.dialog.open).toBe(false);
 const u=setup();click(u.trigger);u.binding.destroy();expect(u.dialog.open).toBe(false);click(u.trigger);expect(u.dialog.open).toBe(false);
});
it('Tab and Shift+Tab cycle inside the two choices',()=>{
 const t=setup();click(t.trigger);
 for(const shift of [false,false,true]){const before=t.doc.activeElement;const key=Object.assign(new Event('keydown',{cancelable:true}),{key:'Tab',shiftKey:shift});t.dialog.dispatchEvent(key);expect(key.defaultPrevented).toBe(true);expect(t.doc.activeElement).toBe(before===t.resume?t.accept:t.resume);}
});
