import { afterEach, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { GameScene } from './gameScene';
afterEach(() => vi.unstubAllGlobals());
function setup() {
 const fail = vi.fn();
 vi.stubGlobal('window', { checkersStartup: { status: vi.fn(), fail } });
 const scene = new GameScene() as any;
 let onError!: (file: { key?: string }) => void;
 scene.load = { on: (_: string, callback: typeof onError) => { onError = callback; } };
 scene.preload();
 return { scene, fail, onError };
}
it.each(['selection_king-seal', 'king-fire_idle-back'])('missing optional %s leaves the match and warmup available', key => {
 const { scene, fail, onError } = setup();
 onError({ key });
 expect(scene.startupFailed).toBe(false);
 expect(fail).not.toHaveBeenCalled();
});
it.each(['marker_staples', 'bunker-panel', undefined])('missing required %s still fails startup', key => {
 const { scene, fail, onError } = setup();
 onError({ key });
 expect(scene.startupFailed).toBe(true);
 expect(fail).toHaveBeenCalledOnce();
});
