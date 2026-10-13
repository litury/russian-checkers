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
import { KingFire } from '@/client/modules/board/kingFire';
import { kingFireSheets } from '@/client/modules/board/kingFireAssets';

it('plays ignite on promotion including reduced motion, trail only on animated king takeoff', () => {
 const heard: string[] = [];
 bindKingFireSfx(name => heard.push(name));
 kingFireIgniteSfx(true);
 kingFireTrailSfx(true, true);
 kingFireTrailSfx(false, false);
 expect(heard).toEqual([kingFireIgniteCue]); // semantic promotion in reduced motion
 heard.length = 0;
 kingFireIgniteSfx(false);
 kingFireTrailSfx(true, false);
 expect(heard).toEqual([kingFireIgniteCue, kingFireTrailCue]);
 expect(kingFireIgniteCue).toBe('ignite-a');
 expect(kingFireTrailCue).toBe('trail-b');
 bindKingFireSfx(() => {});
});

it('recovers late fire sheets without replaying an obsolete promotion one-shot', () => {
 let ready = false;
 const heard: string[] = [];
 bindKingFireSfx(name => heard.push(name));
 const sprite = () => {
  const object: Record<string, unknown> = {};
  for (const name of ['setOrigin','setScale','setDepth','setName','setData','setPosition','setFrame','setVisible','destroy'])
   object[name] = () => object;
  return object;
 };
 const scene = {
  textures: { exists: () => ready, get: (key: string) => ({ frameTotal: kingFireSheets[key.replace('king-fire_', '') as keyof typeof kingFireSheets].frames + 1 }) },
  add: { sprite },
 };
 const flames = new KingFire(scene as never);
 flames.ignite({}, { x: 0, y: 0 }, 44, false);
 expect(heard).toEqual([kingFireIgniteCue]);
 ready = true; flames.update(16);
 expect(heard).toEqual([kingFireIgniteCue]);
 flames.ignite({}, { x: 44, y: 44 }, 44, false);
 expect(heard).toEqual([kingFireIgniteCue, kingFireIgniteCue]);
 bindKingFireSfx(() => {});
});

it('hooks the existing king-fire visual events and does not use orc voice', () => {
 expect(fire).toContain('kingFireIgniteSfx');
 expect(fire).toContain('kingFireTrailSfx');
 expect(audio).toContain('bindKingFireSfx');
 expect(audio).not.toContain("say('ignite-a')");
 expect(audio).not.toContain("say('trail-b')");
});
