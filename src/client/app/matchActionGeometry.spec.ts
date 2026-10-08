import { expect, it } from 'vitest';
import { matchActionGeometry } from './matchActionGeometry';
import { matchLayout } from '../config/matchLayout';
it.each([[390,844],[1280,720],[1024,768]])('anchors 44px targets inside the live card at %s × %s', (w,h) => {
 const l=matchLayout(w,h), card={...l.you,scaleX:l.panelScale,scaleY:l.panelScale};
 const box=matchActionGeometry(card);
 expect(box.left).toBe(card.x+20*card.scaleX);
 expect(box.left-(card.x+10*card.scaleX)).toBeCloseTo(10*card.scaleX);
 expect(box.top+box.height).toBe(card.y+89*card.scaleY-4);
 expect(box.tooltipBelow).toBe(w===1024);
 expect(box.width).toBe(192); expect(box.height).toBe(44);
 expect(box.top).toBeGreaterThan(card.y+30*card.scaleY);
 expect(box.left+box.width).toBeLessThan(card.x+240*card.scaleX);
 expect(box.top+box.height).toBeLessThan(h);
});

it('places the explanation below a card close to the viewport top', () => {
 expect(matchActionGeometry({x:0,y:48,scaleX:1,scaleY:1}).tooltipBelow).toBe(true);
 expect(matchActionGeometry({x:0,y:49,scaleX:1,scaleY:1}).tooltipBelow).toBe(false);
});
