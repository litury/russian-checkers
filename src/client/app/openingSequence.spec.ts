import { expect, it } from 'vitest';
import scene from './gameScene.ts?raw';
import { OpeningGates, gatePose } from './openingGates';
it('finishes gates at 2000ms with all moving parts outside', () => {
 const gates = new OpeningGates(); let ready = false;
 gates.start(() => { ready = true; });
 gates.advance(1999); expect(ready).toBe(false);
 gates.advance(1); expect(ready).toBe(true);
 expect(gatePose(2000)).toEqual({press:1,slide:1,title:1,doors:1});
});
it('starts panels only from the gate completion callback', () => {

 expect(scene).toContain('this.title.depart(startPanels)');
 expect(scene).toContain('this.hud.prepareClosed()');
 expect(scene).not.toContain('this.hud.setVisible(!fromOpening)');
});
