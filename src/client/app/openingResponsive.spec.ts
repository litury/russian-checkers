import {expect,it} from 'vitest';
import html from '../../../index.html?raw';
it('renders independent proportional checkers on separate leaves',()=>{
 expect(html).toContain('gate-piece-slot gate-piece-ivory is-chosen');
 expect(html).toContain('gate-piece-slot gate-piece-black');
 expect(html).toContain('/ui/opening/ivory_disk.webp');
 expect(html).toContain('/ui/opening/black_disk.webp');
 expect(html).toContain('opening-color-white');
});
