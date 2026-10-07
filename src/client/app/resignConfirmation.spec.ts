import { afterEach, expect, it, vi } from 'vitest';
import { bindResignConfirmation } from './resignConfirmation';
function setup() {
 const doc={activeElement:null as unknown,getElementById:(id:string)=>nodes[id]};
 const button=()=>Object.assign(new EventTarget(),{disabled:false,hidden:false,focus(){doc.activeElement=this;}});
 const trigger=button(),resume=button(),accept=button();
 const dialog=Object.assign(new EventTarget(),{open:false,showModal(){this.open=true;},close(){this.open=false;this.dispatchEvent(new Event('close'));}});
 const nodes:Record<string,unknown>={'resign-confirmation':dialog,'resign-continue':resume,'resign-confirm':accept};
 vi.stubGlobal('document',doc);const confirm=vi.fn();let available=true;
 const binding=bindResignConfirmation(trigger as any,confirm,()=>available)!;
 return {doc,trigger,resume,accept,dialog,confirm,binding,unavailable:()=>{available=false;}};
}
const click=(el:EventTarget)=>el.dispatchEvent(new Event('click'));
afterEach(()=>vi.unstubAllGlobals());
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
