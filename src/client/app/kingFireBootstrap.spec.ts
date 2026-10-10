import { afterEach, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, Textures: { FilterMode: { LINEAR: 1 } } } }));
vi.mock('./boardVerdict', () => ({ createResultOverlay: vi.fn(() => ({ layout: vi.fn() })) }));
import { GameScene } from './gameScene';
import { createResultOverlay } from './boardVerdict';
import sceneSource from './gameScene.ts?raw';
it('keeps optional fire failure nonfatal while critical loader failure stays fatal', () => {
 vi.stubGlobal('window', { checkersStartup: { status: vi.fn(), fail: vi.fn() } });
 const s: any = new GameScene(); let handler: (file: {key:string}) => void = () => {};
 s.load = { on: vi.fn((_name, callback) => { handler = callback; }) }; s.preload();
 handler({key:'king-fire_idle-front'}); expect(s.startupFailed).toBe(false);
 expect(window.checkersStartup.fail).not.toHaveBeenCalled();
 handler({key:'reliquary_board'}); expect(s.startupFailed).toBe(true);
 expect(window.checkersStartup.fail).toHaveBeenCalledOnce();
});
const drain = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// 0c16917 split three async routes: king-fire, window, deferred result pack.
// Current main replaced idle window by playfieldReady and removed result pack.
it('window resolves while interactive/king-fire stays pending (route 2)', async () => {
 const s: any = new GameScene();
 s.playfieldReady = Promise.resolve(); s.interactiveReady = new Promise(() => {});
 const overlay = {}; s.ensureOverlay = vi.fn(() => overlay); s.bootKingFire = vi.fn();
 s.scheduleResultWindow();
 expect(await s.ensureResultOverlay()).toBe(overlay);
 expect(s.bootKingFire).not.toHaveBeenCalled();
});
it('king-fire still boots after failed selection overlay, and its failure is owned (route 1)', async () => {
 const s: any = new GameScene();
 s.playfieldReady = Promise.resolve(); s.interactiveReady = Promise.resolve();
 s.ensureOverlay = vi.fn(() => ({}));
 s.bootSelectionOverlay = vi.fn(async () => { throw new Error('overlay import'); });
 s.bootKingFire = vi.fn(async () => { throw new Error('fire import'); });
 s.scheduleResultWindow(); await drain();
 expect(s.bootKingFire).toHaveBeenCalledOnce();
 expect(s.missingDecoration).toMatchObject({ selectionOverlay: true, kingFire: true });
 expect(await s.ensureResultOverlay()).toBeDefined();
});
it('removed result-pack/idle route cannot gate or enqueue the lightweight verdict (route 3)', async () => {
 expect(sceneSource).not.toContain('bootResultPack'); expect(sceneSource).not.toContain('private idleSlot(');
 const s: any = new GameScene(); s.playfieldReady = Promise.resolve(); s.interactiveReady = Promise.resolve();
 s.ensureOverlay = vi.fn(() => ({})); s.bootSelectionOverlay = vi.fn(async () => {}); s.bootKingFire = vi.fn(async () => {});
 s.scheduleResultWindow(); await drain();
 expect(s.ensureOverlay).toHaveBeenCalledOnce(); expect(s.bootKingFire).toHaveBeenCalledOnce();
});
it.each([[true, true], [false, false]])('fire bootstrap skips a failed/unbuilt scene (%s/%s)', async (failed, built) => {
 const s: any = new GameScene(); s.startupFailed = failed; s.playfieldBuilt = built; s.queueKingFire = vi.fn();
 await s.bootKingFire(); expect(s.queueKingFire).not.toHaveBeenCalled();
});
it('fire bootstrap filters only its own sheets after loader completion', async () => {
 const s: any = new GameScene(); s.playfieldBuilt = true; s.queueKingFire = vi.fn(); s.flushLoader = vi.fn(async () => {});
 const filter = vi.fn(); s.textures = { getTextureKeys: () => ['other', 'king-fire_idle-front'], get: vi.fn(() => ({ setFilter: filter })) };
 await s.bootKingFire(); expect(s.queueKingFire).toHaveBeenCalledOnce();
 expect(s.textures.get).toHaveBeenCalledExactlyOnceWith('king-fire_idle-front'); expect(filter).toHaveBeenCalledOnce();
 s.flushLoader = async () => { s.startupFailed = true; }; filter.mockClear();
 await s.bootKingFire(); expect(filter).not.toHaveBeenCalled();
});
it.each([[true,true],[false,false]])('verdict guard never constructs for failed/unbuilt scene (%s/%s)', (failed,built) => {
 const s: any = new GameScene(); s.startupFailed = failed; s.playfieldBuilt = built;
 expect(s.ensureOverlay()).toBeUndefined(); expect(createResultOverlay).not.toHaveBeenCalled();
});
it('verdict constructs once and reuses existing overlay', () => {
 vi.stubGlobal('location', { search: '' });
 const s: any = new GameScene(); s.playfieldBuilt = true; s.scale = { width: 390, height: 844 };
 const first = s.ensureOverlay(); expect(first).toBeDefined(); expect(s.ensureOverlay()).toBe(first);
 expect(createResultOverlay).toHaveBeenCalledOnce();
});
