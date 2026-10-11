import {afterEach,expect,it,vi} from 'vitest';
import {bindResignConfirmation} from './resignConfirmation';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function setup(reduced=false){
 vi.useFakeTimers();vi.stubGlobal('matchMedia',()=>({matches:reduced}));
 const doc={activeElement:null as unknown,getElementById:(id:string)=>nodes[id],createElement:()=>({setAttribute(){},remove(){},textContent:''})};
 const button=()=>Object.assign(new EventTarget(),{disabled:false,hidden:false,setAttribute(){},removeAttribute(){},focus(){doc.activeElement=this;}});
 const trigger=button(),resume=button(),accept=button();
 const attributes=new Map();const dialog=Object.assign(button(),{open:false,setAttribute:(k:string,v:string)=>attributes.set(k,v),removeAttribute:(k:string)=>attributes.delete(k),showModal(){dialog.open=true;},close(){dialog.open=false;dialog.dispatchEvent(new Event('close'));}});
 const nodes:Record<string,unknown>={'resign-confirmation':dialog,'resign-continue':resume,'resign-confirm':accept};vi.stubGlobal('document',doc);
 const confirm=vi.fn();const binding=bindResignConfirmation(trigger as any,confirm,()=>true)!;
 trigger.dispatchEvent(new Event('click'));return {dialog,resume,accept,trigger,doc,attributes,confirm,binding};
}
for(const delay of [50,300])it(`cancel at ${delay}ms retains modal for exit and restores focus`,()=>{
 const t=setup();vi.advanceTimersByTime(delay);t.resume.dispatchEvent(new Event('click'));
 expect(t.dialog.open).toBe(true);expect(t.attributes.get('data-closing')).toBe('true');
 t.accept.dispatchEvent(new Event('click'));expect(t.confirm).not.toHaveBeenCalled();
 vi.advanceTimersByTime(279);expect(t.dialog.open).toBe(true);vi.advanceTimersByTime(1);
 expect(t.dialog.open).toBe(false);expect(t.doc.activeElement).toBe(t.trigger);
});
it('Esc prevents native instant close; destroy clears pending exit',()=>{const t=setup();const e=new Event('cancel',{cancelable:true});t.dialog.dispatchEvent(e);expect(e.defaultPrevented).toBe(true);expect(t.dialog.open).toBe(true);t.binding.destroy();expect(t.dialog.open).toBe(false);expect(vi.getTimerCount()).toBe(0);});
it('reduced motion cancels synchronously',()=>{const t=setup(true);t.resume.dispatchEvent(new Event('click'));expect(t.dialog.open).toBe(false);expect(vi.getTimerCount()).toBe(0);});
