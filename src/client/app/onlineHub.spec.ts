import {afterEach, expect, it, vi} from 'vitest';
import {createOnlineHub} from './onlineHub';

function setup() {
 const win = new EventTarget();
 const title = {textContent:'',focus:vi.fn()};
 const trigger = {focus:vi.fn()};
 const buttons = ['find','create','enter','cancel'].map(action => Object.assign(new EventTarget(), {dataset:{action}}));
 const dialog = Object.assign(new EventTarget(), {
  open:false, innerHTML:'', id:'', setAttribute:vi.fn(), remove:vi.fn(),
  querySelector:()=>title, querySelectorAll:()=>buttons,
  showModal(){this.open=true;}, close(){this.open=false;},
 });
 const stack: unknown[] = [{previous:'menu'}];
 const history = {state:stack[0], pushState:vi.fn((state:unknown)=>{stack.push(state);history.state=state;}),back:vi.fn()};
 vi.stubGlobal('document', {createElement:()=>dialog, body:{append:vi.fn()},getElementById:()=>trigger});
 vi.stubGlobal('window',win);
 vi.stubGlobal('history',history);
 const actions = {find:vi.fn(),create:vi.fn(),enter:vi.fn(),cancel:vi.fn()};
 const hub = createOnlineHub(actions);
 const finishBack = () => {stack.pop();history.state=stack.at(-1);win.dispatchEvent(new Event('popstate'));};
 return {hub,actions,dialog,title,trigger,history,finishBack,buttons};
}
afterEach(()=>vi.unstubAllGlobals());
it('opens once, focuses heading, and renders only real presence',()=>{
 const {hub,dialog,title,history}=setup();
 hub.setVisible(true);hub.setVisible(true);
 expect(dialog.open).toBe(true);expect(history.pushState).toHaveBeenCalledTimes(1);
 expect(title.focus).toHaveBeenCalledTimes(1);
 hub.setCount(7);expect(title.textContent).toBe('Онлайн: 7');
 hub.setCount(null);expect(title.textContent).toBe('Онлайн');
 expect(dialog.innerHTML).not.toContain('Отмена');
});
it.each(['find','create','enter'] as const)('forwards %s without canceling its search on pending back', action=>{
 const {hub,buttons,actions,finishBack,dialog}=setup();
 hub.setVisible(true);buttons.find(b=>b.dataset.action===action)!.dispatchEvent(new Event('click'));
 expect(actions[action]).toHaveBeenCalledTimes(1);
 hub.setVisible(false);finishBack();
 expect(dialog.open).toBe(false);expect(actions.cancel).not.toHaveBeenCalled();
});
it.each(['cancel','escape','back'])('returns to menu once through %s',method=>{
 const {hub,dialog,buttons,finishBack,actions,trigger}=setup();hub.setVisible(true);
 if(method==='back')finishBack();
 else {
  if(method==='escape')dialog.dispatchEvent(new Event('cancel',{cancelable:true}));
  else buttons.find(b=>b.dataset.action==='cancel')!.dispatchEvent(new Event('click'));
  finishBack();
 }
 expect(actions.cancel).toHaveBeenCalledTimes(1);expect(dialog.open).toBe(false);expect(trigger.focus).toHaveBeenCalledTimes(1);
});
it('defers a rapid reopen until the previous history entry has been consumed',()=>{
 const {hub,finishBack,dialog,history,actions}=setup();
 hub.setVisible(true);hub.setVisible(false);hub.setVisible(true);
 expect(dialog.open).toBe(false);finishBack();
 expect(dialog.open).toBe(true);expect(history.pushState).toHaveBeenCalledTimes(2);expect(actions.cancel).not.toHaveBeenCalled();
});
it('disposes without stale popstate actions',()=>{
 const {hub,finishBack,dialog,actions}=setup();hub.setVisible(true);hub.dispose();finishBack();
 expect(dialog.remove).toHaveBeenCalledTimes(1);expect(actions.cancel).not.toHaveBeenCalled();expect(dialog.open).toBe(false);
});
