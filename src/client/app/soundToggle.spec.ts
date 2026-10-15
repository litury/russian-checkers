import {expect,it} from 'vitest';
import html from '../../../index.html?raw';

// Execute the actual HTML-first settings owner, including its persistence path.
function boot(storage=new Map<string,string>()) {
 const nodes=new Map<string,any>();
 const byId=(id:string)=>{if(!nodes.has(id))nodes.set(id,{checked:false,value:'',textContent:'',setAttribute(k:string,v:string){this[k]=v;},addEventListener(){}});return nodes.get(id);};
 const window:any={dispatchEvent(){}};
 const source=html.slice(html.indexOf(' const keys ='),html.indexOf(" const play = byId('opening-play');"));
 new Function('byId','window','localStorage','CustomEvent',source)(byId,window,{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},class {});
 return {window,byId,storage};
}
it('toggles persisted settings mute and restores its checkbox after reload',()=>{
 const first=boot(),button=first.byId('settings-muted');
 expect(button.checked).toBe(false);
 button.onchange({target:{checked:true}});
 expect(first.window.checkersSettings.get().muted).toBe(true);
 expect(first.storage.get('checkers.sfxMuted')).toBe('1');
 const second=boot(first.storage),restored=second.byId('settings-muted');
 expect(restored.checked).toBe(true);
 restored.onchange({target:{checked:false}});
 expect(second.window.checkersSettings.get().muted).toBe(false);
 expect(second.storage.get('checkers.sfxMuted')).toBe('0');
});
it('preserves every existing persisted preference and independent levels',()=>{
 const first=boot();
 first.window.checkersSettings.set({master:.6,music:.2,effects:.7,muted:true,autoMove:false,botSkill:'hard'});
 first.byId('settings-muted').onchange({target:{checked:false}});
 const second=boot(first.storage);
 expect(second.window.checkersSettings.get()).toEqual({master:.6,music:.2,effects:.7,muted:false,autoMove:false,botSkill:'hard'});
 expect(second.byId('settings-music').value).toBe(.2);
 expect(second.byId('settings-effects').value).toBe(.7);
 expect(second.byId('settings-auto').checked).toBe(false);
 expect(second.byId('settings-bot-hard').checked).toBe(true);
});
