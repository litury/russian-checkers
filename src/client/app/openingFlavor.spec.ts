import { expect, it } from 'vitest';
import html from '../../../index.html?raw';
it('removes slogans and their timers while preserving the startup compatibility API', () => {
 expect(html).not.toContain('class="opening-slogan"');
 expect(html).not.toContain('id="opening-flavor-text"');
 const script = html.match(/<script id="opening-flavor">([\s\S]*?)<\/script>/)![1];
 const window = {} as {checkersFlavor:{setState:(state:string)=>void}};
 new Function('window',script)(window);
 expect(() => window.checkersFlavor.setState('ready')).not.toThrow();
 expect(script).not.toMatch(/setTimeout|addEventListener|MutationObserver/);
});
