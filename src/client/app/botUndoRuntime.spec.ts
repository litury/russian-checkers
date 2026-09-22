import { afterEach, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('./settings', () => ({ getAutoMove: () => auto, getBotSkill: () => 'normal' }));
let auto = false;
vi.mock('@/online/cloud', () => ({ recordBotMatch: vi.fn(), probeApi: vi.fn() }));
import { GameScene } from './gameScene';
import { createInitialPosition } from '@/rules';
const sq = (s: string) => ({ col: s.charCodeAt(0) - 97, row: +s[1] - 1 });
function setup() {
 const s = new GameScene() as any;
 const button = Object.assign(new EventTarget(), {
  hidden: true, disabled: true,
  click(this: EventTarget & { disabled: boolean }) { if (!this.disabled) this.dispatchEvent(new Event('click')); },
 });
 const resign = Object.assign(new EventTarget(), {
  hidden: true, disabled: false,
  click(this: EventTarget & { disabled: boolean }) { if (!this.disabled) this.dispatchEvent(new Event('click')); },
 });
 const rail = { hidden: true, inert: false, style: { visibility: '' }, setAttribute: vi.fn() };
 vi.stubGlobal('document', { getElementById: (id: string) => id === 'match-undo' ? button : id === 'match-resign' ? resign : id === 'match-rail' ? rail : null });
 s.position = createInitialPosition(); s.phase = 'human';
 const tasks: (() => void)[] = [];
 s.time = { now: 1000, delayedCall: vi.fn((_ms, cb) => { tasks.push(cb); return { remove: vi.fn() }; }) };
 s.clockStartedAt = 1000;
 s.hud = { setTurn: vi.fn(), setClock: vi.fn() };
 s.board = { reset: vi.fn(), sync: vi.fn(), clearOpeningHint: vi.fn(), setWaitingIdle: vi.fn(), notePly: vi.fn(), playMove: vi.fn((_m, done) => done()) };
 s.overlay = { hide: vi.fn(), show: vi.fn() };
 s.sdk = { showFullscreenAdv: vi.fn() };
 return { s, tasks, button, resign, rail };
}
afterEach(() => { auto = false; vi.unstubAllGlobals(); });
it.each(['white','black'])('resignation shows loss relative to human %s',async(side)=>{
 const {s}=setup();s.humanSide=side;s.ensureResultOverlay=vi.fn(async()=>s.overlay);
 s.resignMatch();await Promise.resolve();
 expect(s.overlay.show).toHaveBeenCalledWith(side==='white'?'black':'white',side);
});
it('draw terminates with a neutral result and no victory voice',async()=>{
 const {s}=setup();s.title={resultSting:vi.fn(),speakOrcTurn:vi.fn()};
 s.ensureResultOverlay=vi.fn(async()=>s.overlay);
 s.endMatch('draw');
 s.sdk.showFullscreenAdv.mock.calls[0][0].onClose();await Promise.resolve();
 expect(s.phase).toBe('over');expect(s.overlay.show).toHaveBeenCalledWith('draw','white');
 expect(s.title.resultSting).not.toHaveBeenCalled();expect(s.title.speakOrcTurn).not.toHaveBeenCalled();
});
it('late result loader cannot reopen after leaving result phase',async()=>{
 const {s}=setup();let loaded:(v:any)=>void=()=>{};
 s.ensureResultOverlay=()=>new Promise(resolve=>loaded=resolve);s.resignMatch();
 s.phase='title';loaded(s.overlay);await Promise.resolve();expect(s.overlay.show).not.toHaveBeenCalled();
});
function human(s: any) { s.onSquare(sq('c3')); s.onSquare(sq('d4')); }
it('manual move plus bot reply undo restores position, clocks and history', () => {
 const { s } = setup(); const origin = structuredClone(s.position);
 human(s); expect(s.botUndoStack).toHaveLength(1);
 s.playBot(); expect(s.matchPlies).toHaveLength(2);
 s.undoBot(); expect(s.position).toEqual(origin); expect(s.matchPlies).toEqual([]);
 expect(s.clocks).toEqual({ white: 60000, black: 60000 }); expect(s.phase).toBe('human');
});
it('undo cancels bot animation and ignores even a delivered stale completion', () => {
 const { s } = setup(); const origin = structuredClone(s.position); human(s);
 let finish = () => {};
 s.board.playMove.mockImplementation((_m: unknown, done: () => void) => { finish = done; });
 s.playBot(); expect(s.moving).toBe(true);
 s.undoBot(); expect(s.board.reset).toHaveBeenCalledTimes(1);
 finish(); expect(s.position).toEqual(origin); expect(s.matchPlies).toEqual([]); expect(s.phase).toBe('human');
});
function chainPosition(s: any) {
 s.position.squares = Array.from({ length: 8 }, () => Array(8).fill(null));
 for (const [name, side] of [['c3','white'], ['d4','black'], ['f6','black'], ['h8','black']]) {
  const p = sq(name); s.position.squares[p.row][p.col] = { side, kind: 'man' };
 }
}
it('whole manual chain creates one snapshot and undoes both hops', () => {
 const { s } = setup(); chainPosition(s); const origin = structuredClone(s.position);
 s.onSquare(sq('c3')); s.onSquare(sq('e5')); s.onSquare(sq('g7'));
 expect(s.botUndoStack).toHaveLength(1); expect(s.matchPlies).toHaveLength(1);
 s.undoBot(); expect(s.position).toEqual(origin); expect(s.humanChain).toBeNull();
});
it('undo of forced auto move does not immediately replay it', () => {
 const { s } = setup(); chainPosition(s); const origin = structuredClone(s.position); auto = true;
 s.maybeAutoMove(); expect(s.botUndoStack).toHaveLength(1);
 s.undoBot(); expect(s.position).toEqual(origin); expect(s.botUndoStack).toHaveLength(0);
});
it('removed bot timer cannot play during a newer bot turn', () => {
 const { s, tasks } = setup(); human(s); const old = tasks[0]; const timer = s.botTimer;
 s.undoBot(); expect(timer.remove).toHaveBeenCalledWith(false);
 human(s); const position = structuredClone(s.position); old();
 expect(s.position).toEqual(position); expect(s.matchPlies).toHaveLength(1);
});
it('undo after loss dismisses result and invalidates deferred result callback', async () => {
 const { s } = setup();
 s.position.squares = Array.from({ length: 8 }, () => Array(8).fill(null));
 s.position.squares[2][2] = { side: 'white', kind: 'man' };
 s.position.squares[4][4] = { side: 'black', kind: 'man' };
 const origin = structuredClone(s.position); human(s);
 s.ensureResultOverlay = vi.fn(async () => s.overlay);
 s.playBot(); expect(s.phase).toBe('over');
 const show = s.sdk.showFullscreenAdv.mock.calls[0][0].onClose;
 show(); await Promise.resolve(); await Promise.resolve();
 expect(s.overlay.show).toHaveBeenCalledWith('black', 'white');
 s.overlay.show.mockClear();
 s.undoBot(); show(); await Promise.resolve(); await Promise.resolve();
 expect(s.overlay.hide).toHaveBeenCalledWith(true); expect(s.overlay.show).not.toHaveBeenCalled();
 expect(s.position).toEqual(origin); expect(s.phase).toBe('human');
});
it('undo during human hop ignores its stale callback', () => {
 const { s } = setup(); const origin = structuredClone(s.position); let finish = () => {};
 s.board.playMove.mockImplementation((_m: unknown, done: () => void) => { finish = done; });
 human(s); s.undoBot(); finish();
 expect(s.position).toEqual(origin); expect(s.matchPlies).toEqual([]); expect(s.selected).toBeNull();
});
it('online manual moves create no bot snapshot and undo has no effect', () => {
 const { s } = setup(); s.online = true; s.onlineBegun = true; s.serverTurn = 'white'; s.live = { move: vi.fn() };
 human(s); expect(s.live.move).toHaveBeenCalledTimes(1); expect(s.botUndoStack).toEqual([]);
 s.undoBot(); expect(s.board.reset).not.toHaveBeenCalled();
});
it('undo after resignation rejects a late overlay load', async () => {
 const { s } = setup(); human(s); s.playBot();
 let loaded: (overlay: any) => void = () => {};
 s.ensureResultOverlay = () => new Promise(resolve => { loaded = resolve; });
 s.resignMatch(); expect(s.phase).toBe('over');
 s.undoBot(); loaded(s.overlay); await Promise.resolve();
 expect(s.overlay.show).not.toHaveBeenCalled(); expect(s.phase).toBe('human');
});
it('button cancels first manual animation and rejects its late completion', () => {
 const { s, button, tasks } = setup();
 const origin = structuredClone(s.position);
 s.bindUndoButton(); s.paintUndo();
 expect(button.hidden).toBe(false); expect(button.disabled).toBe(true);
 button.click(); expect(s.board.reset).not.toHaveBeenCalled();
 let finish = () => {};
 s.board.playMove.mockImplementation((_m: unknown, done: () => void) => { finish = done; });
 human(s);
 expect(s.botUndoStack).toHaveLength(1); expect(s.moving).toBe(true);
 expect(button.disabled).toBe(false);
 button.click();
 expect(s.board.reset).toHaveBeenCalledTimes(1);
 expect(s.moving).toBe(false); expect(button.disabled).toBe(true);
 finish();
 expect(s.position).toEqual(origin); expect(s.matchPlies).toEqual([]);
 expect(s.humanChain).toBeNull(); expect(s.phase).toBe('human'); expect(tasks).toEqual([]);
 button.click(); expect(s.board.reset).toHaveBeenCalledTimes(1);
});
it('online resign sends live resign; undo stays hidden', () => {
 const { s, button, resign, rail } = setup();
 s.online = true; s.live = { resign: vi.fn() };
 s.paintUndo();
 expect(rail.hidden).toBe(false);
 expect(button.hidden).toBe(true);
 expect(resign.hidden).toBe(false);
 s.resignMatch();
 expect(s.live.resign).toHaveBeenCalledTimes(1);
 expect(s.phase).toBe('human');
 expect(s.board.reset).not.toHaveBeenCalled();
});
it('handoff emits only after a whole nonterminal ply; never refresh, tick, undo or resign', () => {
 const { s } = setup(); s.title = { turnHandoff: vi.fn(), resultSting: vi.fn() };
 human(s); expect(s.title.turnHandoff).toHaveBeenCalledTimes(1);
 expect(s.hud.setClock.mock.lastCall?.[2]).toBe('black');
 s.refresh(); s.tickClock(); expect(s.title.turnHandoff).toHaveBeenCalledTimes(1);
 s.playBot(); expect(s.title.turnHandoff).toHaveBeenCalledTimes(2);
 s.undoBot(); expect(s.title.turnHandoff).toHaveBeenCalledTimes(2);
 s.ensureResultOverlay = async () => s.overlay;
 s.resignMatch(); s.tickClock(); expect(s.title.turnHandoff).toHaveBeenCalledTimes(2);
});
it('handoff is silent between capture hops and on a winning final capture', () => {
 const { s } = setup(); s.title = { turnHandoff: vi.fn(), resultSting: vi.fn() }; chainPosition(s);
 s.onSquare(sq('c3')); s.onSquare(sq('e5'));
 expect(s.position.turn).toBe('white'); expect(s.title.turnHandoff).not.toHaveBeenCalled();
 s.onSquare(sq('g7')); expect(s.title.turnHandoff).toHaveBeenCalledTimes(1);
 s.undoBot(); s.position.squares[7][7] = null;
 s.onSquare(sq('c3')); s.onSquare(sq('e5')); s.onSquare(sq('g7'));
 expect(s.phase).toBe('over'); expect(s.title.turnHandoff).toHaveBeenCalledTimes(1);
});

it('GT-01 reserves rail geometry but conceals actions until input/clock readiness', () => {
 const { s, rail, button, resign } = setup();
 Object.assign(button, { style: { visibility: '' } });
 Object.assign(resign, { style: { visibility: '' } });
 s.countingIn = true;
 s.paintUndo();
 expect(rail.hidden).toBe(false); // preserve existing layout budget
 expect(rail.style.visibility).toBe('hidden');
 expect(rail.inert).toBe(true);
 expect(rail.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
 expect((button as any).style.visibility).toBe('hidden');
 expect((resign as any).style.visibility).toBe('hidden');
 expect(button.disabled).toBe(true);
 expect(resign.disabled).toBe(true);
 s.countingIn = false;
 s.paintUndo();
 expect(rail.style.visibility).toBe('');
 expect(rail.inert).toBe(false);
 expect((button as any).style.visibility).toBe('');
 expect((resign as any).style.visibility).toBe('');
 expect(resign.disabled).toBe(false);
 s.phase = 'title'; s.paintUndo(); expect(rail.hidden).toBe(true);
});

it('empty history undo is a no-op', () => {
 const { s } = setup(); const origin = structuredClone(s.position);
 s.undoBot(); expect(s.position).toEqual(origin); expect(s.board.reset).not.toHaveBeenCalled();
});
