import {expect, it, vi} from 'vitest';
import html from '../../../index.html?raw';
import overlay from './openingOverlay.ts?raw';

function boot() {
 class Node extends EventTarget {
  dataset: Record<string,string> = {};
  disabled = false; inert = false; textContent = '';
  attrs = new Map<string,string>();
  classList = {contains: () => false};
  focus = vi.fn();
  label = {textContent:''};
  querySelector(selector:string) {return selector === '.opening-actions' ? this : this.label;}
  setAttribute(key:string,value:string) {this.attrs.set(key,value);}
  removeAttribute(key:string) {this.attrs.delete(key);}
 }
 const root = new Node(), play = new Node(), options = new Node();
 const nodes: Record<string,Node> = {opening:root,'opening-play':play,'opening-options':options};
 const startup = {playCommitted:false,pendingOnline:false};
 const script = html.match(/<script id="opening-mode-navigation">([\s\S]*?)<\/script>/)![1];
 new Function('document','window',script)({getElementById:(id:string)=>nodes[id]},{checkersStartup:startup});
 const click = (node:Node,detail=1) => node.dispatchEvent(Object.assign(new Event('click',{cancelable:true}),{detail}));
 return {root,play,options,startup,click};
}
it('replaces the same menu area without invoking play, then restores focus and settings semantics', () => {
 const b=boot(); const start=vi.fn(); b.play.addEventListener('click',start);
 b.click(b.play);
 expect(start).not.toHaveBeenCalled();
 expect(b.root.dataset.menuPage).toBe('modes');
 expect(b.play.label.textContent).toBe('С ботом');
 expect(b.options.label.textContent).toBe('Назад');
 expect(b.options.attrs.has('aria-haspopup')).toBe(false);
 b.click(b.play); expect(start).toHaveBeenCalledOnce();
 b.click(b.options);
 expect(b.root.dataset.menuPage).toBe('main');
 expect(b.play.label.textContent).toBe('Играть');
 expect(b.options.label.textContent).toBe('Настройки');
 expect(b.options.attrs.get('aria-controls')).toBe('opening-settings-dialog');
 expect(b.play.focus).toHaveBeenCalledWith({preventScroll:true});
});
it('ignores the second click of a double-click and does not return while start is committed', () => {
 const b=boot(); const start=vi.fn(); b.play.addEventListener('click',start);
 b.click(b.play); b.click(b.play,2); expect(start).not.toHaveBeenCalled();
 b.startup.playCommitted=true; b.click(b.options);
 expect(b.root.dataset.menuPage).toBe('modes');
});
it('Escape returns from modes but not an in-flight start; return from a match resets the menu', () => {
 const b=boot(); b.click(b.play);
 const escape=()=>b.root.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{key:'Escape'}));
 b.startup.pendingOnline=true; escape(); expect(b.root.dataset.menuPage).toBe('modes');
 b.startup.pendingOnline=false; escape(); expect(b.root.dataset.menuPage).toBe('main');
 b.click(b.play); b.root.dispatchEvent(new Event('opening-main-menu'));
 expect(b.root.dataset.menuPage).toBe('main');
});
it.each([null, 0, 2, 1234])('renders real presence %s inside the button, hiding only unknown data', liveTotal => {
 const code = overlay.match(/const renderLive = \(\) => \{([\s\S]*?)\n \};/)?.[1];
 if (!code) throw new Error('Missing real presence renderer');
 const menuCount = {hidden:false,textContent:''};
 const hub = {setCount:vi.fn()};
 new Function('liveTotal','menuCount','hub','searchCopyEl',code)(liveTotal,menuCount,hub,null);
 expect(menuCount.hidden).toBe(liveTotal === null);
 expect(menuCount.textContent).toBe(liveTotal === null ? '' : ` · ${liveTotal}`);
 expect(hub.setCount).toHaveBeenCalledWith(liveTotal);
 expect(overlay).toContain('online?.append(menuCount)');
});
