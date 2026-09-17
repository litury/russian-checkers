import { expect, it } from 'vitest';
import scene from './gameScene.ts?raw';

it('online auto-move sends live.move like a click, not local-only apply', () => {
 expect(scene).toContain('maybeAutoMove');
 expect(scene).toMatch(/private playHuman\(move: IMove\): void \{\s*this\.animateMove\(move, \(\) => \{\s*if \(this\.online\) this\.live\?\.move\(move\);\s*else this\.completeHumanMove\(move\);\s*\}\);/s);
 expect(scene).not.toMatch(/private playHuman\(move: IMove\): void \{\s*this\.animateMove\(move, \(\) => this\.completeHumanMove\(move\)\);/s);
});
