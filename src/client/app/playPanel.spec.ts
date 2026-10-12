import { expect, it } from 'vitest';
import audio from './menuAudio.ts?raw';

it('uses play-b only on Играть, leaving rules/settings on ui_click', () => {
 expect(audio).toContain("const name=play?'play-b':options?'ui-open':'ui_click'");
 expect(audio).not.toContain("sound('ui_play')");
 expect(audio).toContain('#opening-help,#opening-settings');
 expect(audio).toContain('const emit=()=>sound(name,play?1:options?.3:menuClickLevel)');
});
