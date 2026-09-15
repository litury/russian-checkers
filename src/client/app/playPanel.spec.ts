import { expect, it } from 'vitest';
import audio from './menuAudio.ts?raw';

it('uses play-b only on Играть, leaving rules/settings on ui_click', () => {
 expect(audio).toContain("sound('play-b')");
 expect(audio).not.toContain("sound('ui_play')");
 expect(audio).toContain('#opening-help,#opening-settings');
 expect(audio).toContain("sound('ui_click'");
});
