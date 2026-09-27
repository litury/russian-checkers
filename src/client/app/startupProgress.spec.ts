import { afterEach, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, Textures: { FilterMode: { LINEAR: 1 } } } }));
vi.mock('./assetLoader', () => ({ loadImage: vi.fn() }));
vi.mock('./bunkerPanel', () => ({ preloadBunkerPanels: vi.fn() }));
import { GameScene } from './gameScene';
import { loadImage } from './assetLoader';
import { preloadBunkerPanels } from './bunkerPanel';

function deferred<T = void>() {
 let resolve!: (value: T) => void;
 let reject!: (error: Error) => void;
 const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
 return { promise, resolve, reject };
}
function setup() {
 const status = vi.fn(), fail = vi.fn();
 vi.stubGlobal('window', { devicePixelRatio: 3, innerWidth: 390, checkersStartup: { status, fail } });
 const scene = new GameScene() as any;
 scene.textures = { addImage: vi.fn(), getTextureKeys: () => [] };
 scene.load = { image: vi.fn() };
 return { scene, status, fail };
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('names the marker/HUD stage while those resources still block the board', async () => {
 const { scene, status } = setup();
 const pending = deferred();
 scene.queueTitleCritical = vi.fn(async () => status('Доска и шашки: 8/8'));
 scene.flushLoader = () => pending.promise;
 scene.buildPlayfield = vi.fn();
 const boot = scene.bootPlayfield();
 await Promise.resolve();
 expect(preloadBunkerPanels).toHaveBeenCalledWith(scene);
 expect(status).toHaveBeenLastCalledWith('Загрузка: маркеры и панели…');
 expect(scene.buildPlayfield).not.toHaveBeenCalled();
 pending.resolve(); await boot;
 expect(scene.buildPlayfield).toHaveBeenCalledOnce();
});

it('names the selection stage until interactive resources finish', async () => {
 const { scene, status } = setup();
 const pending = deferred();
 scene.playfieldBuilt = true;
 scene.settlePlayfieldReady();
 scene.flushLoader = () => pending.promise;
 const boot = scene.bootMatchInteractive();
 await Promise.resolve();
 expect(scene.load.image).toHaveBeenCalledWith('selection_king-seal', expect.any(String));
 expect(status).toHaveBeenLastCalledWith('Загрузка: подготовка взаимодействия…');
 let complete = false; void boot.then(() => { complete = true; });
 await Promise.resolve(); expect(complete).toBe(false);
 pending.resolve(); await boot;
 expect(complete).toBe(true);
});

it('failed image keeps the terminal error and ignores delayed sibling textures/progress', async () => {
 const { scene, status, fail } = setup();
 const images: ReturnType<typeof deferred<HTMLImageElement>>[] = [];
 vi.mocked(loadImage).mockImplementation(() => {
  const image = deferred<HTMLImageElement>(); images.push(image); return image.promise;
 });
 const boot = scene.bootPlayfield();
 expect(images.length).toBeGreaterThan(1);
 images[0].reject(new Error('offline'));
 await boot;
 expect(fail).toHaveBeenCalledOnce();
 expect(scene.startupFailed).toBe(true);
 status.mockClear();
 for (const image of images.slice(1)) image.resolve({} as HTMLImageElement);
 await Promise.resolve(); await Promise.resolve();
 expect(status).not.toHaveBeenCalled();
 expect(scene.textures.addImage).not.toHaveBeenCalled();
 expect(scene.load.image).not.toHaveBeenCalled();
 expect(preloadBunkerPanels).not.toHaveBeenCalled();
});
