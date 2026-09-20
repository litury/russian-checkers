import scene from './gameScene.ts?raw';
import { expect, it } from 'vitest';

it('starts the board without waiting for the full selection-v2 atlas', () => {
 const startMatch = scene.match(/private async startMatch\([\s\S]*?\n\t\}/)?.[0] ?? '';
 expect(startMatch).toContain('await this.playfieldReady');
 expect(startMatch).not.toContain('await this.interactiveReady');
 const request = scene.match(/private async requestStartFromOpening\(\): Promise<void> \{[\s\S]*?\n\t\}/)?.[0] ?? '';
 expect(request).toContain('await this.startMatch(true)');
 expect(request).not.toMatch(/await this\.interactiveReady;[\s\S]*await this\.startMatch\(true\)/);
 expect(scene).toContain('queueMatchInteractive');
 expect(scene).toMatch(/interactiveReady[\s\S]*refresh\(\)/);
});
