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
it('starts closed HUD bays only inside completed title/gates callback', () => {
 expect(scene).toContain('this.title.depart(afterTitle)');
 expect(scene).toContain('this.hud.prepareClosed()');
 expect(scene).not.toContain('this.hud.setVisible(!fromOpening)');
 const sequence = scene.slice(scene.indexOf('private beginCountdown'), scene.indexOf('private layout'));
 expect(sequence.indexOf('const afterTitle')).toBeLessThan(sequence.indexOf('hud.startReveal('));
 expect(sequence.indexOf('hud.startReveal(')).toBeLessThan(sequence.indexOf('this.title.depart(afterTitle)'));
});
it('hands input and banks over before the decorative HUD reveal', () => {
 const sequence = scene.slice(scene.indexOf('private beginCountdown'), scene.indexOf('private layout'));
 const body = sequence.slice(
  sequence.indexOf('const afterTitle'),
  sequence.indexOf('if (fromOpening) this.title.depart(afterTitle)'));
 // The reveal is decoration: it starts after the board is already playable.
 expect(body).toContain('hud.startReveal(');
 expect(body).toContain('settle()');
 expect(body).toContain('handshake()');
 expect(body.indexOf('settle()')).toBeLessThan(body.indexOf('hud.startReveal('));
 expect(body.indexOf('handshake()')).toBeLessThan(body.indexOf('hud.startReveal('));
 expect(sequence).not.toContain('hud.startReveal(ready)');
 expect(sequence).not.toContain('hud.startReveal(settle)');
});
