import { expect, it } from 'vitest';
import {
 bindKingFireSfx,
 kingFireIgniteCue,
 kingFireIgniteSfx,
 kingFireTrailCue,
 kingFireTrailSfx,
} from './kingFireSfx';
import fire from '@/client/modules/board/kingFire.ts?raw';
import audio from './menuAudio.ts?raw';

it('plays ignite once on flame start and trail once on a king takeoff, never idle or reduced', () => {
 const heard: string[] = [];
 bindKingFireSfx(name => heard.push(name));
 kingFireIgniteSfx(true);
 kingFireTrailSfx(true, true);
 kingFireTrailSfx(false, false);
 expect(heard).toEqual([]);
 kingFireIgniteSfx(false);
 kingFireTrailSfx(true, false);
 expect(heard).toEqual([kingFireIgniteCue, kingFireTrailCue]);
 expect(kingFireIgniteCue).toBe('ignite-a');
 expect(kingFireTrailCue).toBe('trail-b');
 bindKingFireSfx(() => {});
});

it('hooks the existing king-fire visual events and does not use orc voice', () => {
 expect(fire).toContain('kingFireIgniteSfx');
 expect(fire).toContain('kingFireTrailSfx');
 expect(audio).toContain('bindKingFireSfx');
 expect(audio).not.toContain("say('ignite-a')");
 expect(audio).not.toContain("say('trail-b')");
});
