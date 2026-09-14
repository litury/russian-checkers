import {expect,it} from 'vitest';
import html from '../../../index.html?raw';
it('renders independent proportional checkers on separate leaves',()=>{
 expect(html).toContain('class="gate-piece gate-piece-ivory"');
 expect(html).toContain('class="gate-piece gate-piece-black"');
 expect(html).toContain('/ui/opening/ivory_disk.webp');
 expect(html).toContain('/ui/opening/black_disk.webp');
});
