import {expect,it,vi} from 'vitest';
import {MenuPressState} from './menuPressFeedbackState';
import source from './menuPressFeedback.ts?raw';
it('accepts engineer2 visual container without changing renderer or label layout',()=>{
 expect(source).toContain(':scope > .gate-piece-visual');
});
it('holds one contact until release, without owning selection',()=>{
 const changed=vi.fn(),contact=vi.fn();const press=new MenuPressState(changed,contact);
 press.down('pointer:1');press.down('pointer:1');
 expect(changed.mock.calls).toEqual([[true]]);expect(contact).toHaveBeenCalledTimes(1);
 press.up('pointer:2');expect(press.active).toBe(true);
 press.up('pointer:1');expect(changed.mock.calls).toEqual([[true],[false]]);
});
