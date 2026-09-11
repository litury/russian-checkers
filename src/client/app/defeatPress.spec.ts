import { expect, it, vi } from 'vitest';
import { createDefeatPress } from './defeatPress';
it('confirms once on release, cancels outside, and ignores repeats', () => {
 const feedback = vi.fn(), action = vi.fn();
 const p = createDefeatPress(feedback,action);
 p.down(0); p.cancel(); p.up(0); expect(action).not.toHaveBeenCalled();
 p.down(0); p.up(1); expect(action).not.toHaveBeenCalled();
 p.down(1); p.down(1); p.up(1); p.up(1); p.down(1); p.up(1);
 expect(action).toHaveBeenCalledTimes(1); expect(action).toHaveBeenCalledWith(1);
 p.reset(); p.down(0); p.up(0); expect(action).toHaveBeenCalledTimes(2);
 expect(feedback).toHaveBeenCalledWith(1,false);
});
