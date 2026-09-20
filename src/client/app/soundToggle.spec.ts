import {expect,it} from 'vitest';
import html from '../../../index.html?raw';

// Execute the actual HTML-first settings owner, including its persistence path.
function boot(storage=new Map<string,string>()) {
 const nodes=new Map<string,any>();
 const byId=(id:string)=>{if(!nodes.has(id))nodes.set(id,{checked:false,value:'',textContent:'',setAttribute(k:string,v:string){this[k]=v;},addEventListener(){}});return nodes.get(id);};
 const window:any={dispatchEvent(){}};
 const source=html.slice(html.indexOf(' const keys ='),html.indexOf(' const activity ='));
 new Function('byId','window','localStorage','CustomEvent',source)(byId,window,{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},class {});
 return {window,byId,storage};
}
it('toggles persisted mute and restores its accessible state after reload',()=>{
 const first=boot(),button=first.byId('opening-sound');
 expect(button['aria-pressed']).toBe('true');
 expect(button.title).toBe('Выключить звук');
 button.onclick();
 expect(first.window.checkersSettings.get().muted).toBe(true);
 expect(first.storage.get('checkers.sfxMuted')).toBe('1');
 const second=boot(first.storage),restored=second.byId('opening-sound');
 expect(restored['aria-pressed']).toBe('false');
 expect(restored.title).toBe('Включить звук');
 restored.onclick();
 expect(second.window.checkersSettings.get().muted).toBe(false);
 expect(second.storage.get('checkers.sfxMuted')).toBe('0');
});
it('keeps independent slider levels when toggling and follows settings mute',()=>{
 const {window,byId}=boot();
 window.checkersSettings.set({music:.2,effects:.7,muted:true});
 byId('opening-sound').onclick();
 expect(window.checkersSettings.get()).toMatchObject({music:.2,effects:.7,muted:false});
 window.checkersSettings.set({muted:true});
 expect(byId('opening-sound')['aria-pressed']).toBe('false');
});
