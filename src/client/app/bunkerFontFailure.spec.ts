import { expect, it, vi } from 'vitest';
import source from './bunkerPanel.ts?raw';

// Execute the shipping async font enhancement with its real completion/error path.
const body=source.slice(source.indexOf("void document.fonts?.load("),source.indexOf("\n\tscene.events.on('update', tickFrame);"));
const run=new Function('document','disposed','movingText','paint',body.replace(/^void /,'return '));
it('keeps system-font HUD on rejected font load, with no unhandled rejection',async()=>{
 const paint=vi.fn(),setFontFamily=vi.fn();
 await expect(run({fonts:{load:()=>Promise.reject(new Error('offline'))}},false,[{setFontFamily}],paint)).resolves.toBeUndefined();
 expect(paint).not.toHaveBeenCalled();expect(setFontFamily).not.toHaveBeenCalled();
});
it('successful font arrival paints once, and disposal suppresses late redraw',async()=>{
 const paint=vi.fn(),setFontFamily=vi.fn(),document={fonts:{load:()=>Promise.resolve([])}};
 await run(document,false,[{setFontFamily}],paint);
 expect(paint).toHaveBeenCalledTimes(1);expect(setFontFamily).toHaveBeenCalledWith('"Golos Text", sans-serif');
 await run(document,true,[{setFontFamily}],paint);expect(paint).toHaveBeenCalledTimes(1);
});
