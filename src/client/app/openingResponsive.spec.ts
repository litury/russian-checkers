import {expect,it} from 'vitest';
import html from '../../../index.html?raw';
import css from './openingGates.css?raw';
import transition from './siegeGateTransition.ts?raw';
it('covers the entire responsive surface with proportionally scaled original tooth art',()=>{
 expect(css).toContain('--gate-w:max(1440px,100cqw,150cqh)');
 expect(css).toContain('aspect-ratio:3/2');
 expect(css).toContain('container-type:size');
 expect(css).not.toContain('100vmax');
 expect(css).not.toContain('width:1440px; height:960px');
 expect(css).toContain('.siege-left { clip-path:polygon(');
 expect(css).toContain('.siege-right { clip-path:polygon(');
 for(const side of ['left','right']) expect(html).toContain(`class="siege-layer siege-${side}" src="/src/client/app/ui/siege/gate.webp"`);
});
it('attaches every primary/utility and selection control without changing logical focus order',()=>{
 for(const [id,side] of Object.entries({'opening-play':'left','opening-retry':'left','opening-history':'left','opening-online':'right','opening-options':'right','opening-search':'right','opening-status':'left'})) {
  expect(html).toContain(`id="${id}" data-siege-mount="${side}"`);
 }
 expect(html).toContain('data-chronicle-mount="left"');
 expect(html).toContain('data-chronicle-mount="right"');
 expect(html).toContain('data-side="white"');
 expect(html).toContain('data-side="black"');
 expect(html).not.toContain('data-siege-mount="left" data-side="white"');
 expect(html).not.toContain('data-siege-mount="right" data-side="black"');
 expect(html).toContain('/selection-v2/frames/white/white-55.webp');
 expect(html).toContain('/selection-v2/frames/black/black-00.webp');
 expect(html.indexOf('id="opening-play"')).toBeLessThan(html.indexOf('id="opening-online"'));
 expect(html).toContain('aria-label="Ваша сторона"');
 expect(css).toContain('min-height:44px');
 expect(css).toContain('prefers-reduced-motion:reduce');
 expect(css).toContain('--column:min(184px,calc((100vw - 28px)/2))');
 expect(css).toContain('left:calc(50% - var(--column) - 6px)');
 expect(css).toContain('left:calc(50% + 6px)');
 expect(transition).not.toContain('opacity:');
 expect(transition).not.toContain('duration:120');
});
