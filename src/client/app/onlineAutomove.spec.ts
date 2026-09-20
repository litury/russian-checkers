import { expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('./settings', () => ({ getAutoMove: () => true }));
import { GameScene } from './gameScene';
import { legalMoves, type IPosition } from '@/rules';

function setup() {
 const scene = new GameScene() as any;
 const position: IPosition = {
  turn: 'white',
  squares: Array.from({ length: 8 }, () => Array(8).fill(null)),
 };
 position.squares[2][2] = { side: 'white', kind: 'man' };
 position.squares[3][3] = { side: 'black', kind: 'man' };
 position.squares[7][7] = { side: 'black', kind: 'man' };
 let finish = () => {};
 scene.position = position;
 scene.online = true;
 scene.onlineBegun = true;
 scene.serverTurn = 'white';
 scene.phase = 'human';
 scene.live = { move: vi.fn() };
 scene.board = { playMove: vi.fn((_move: unknown, done: () => void) => { finish = done; }) };
 return { scene, finish: () => finish() };
}

it('online auto-move sends exactly one legal route after animation, without local commit', () => {
 const { scene, finish } = setup();
 const origin = structuredClone(scene.position);
 const routes = legalMoves(origin);
 expect(routes).toHaveLength(1);
 const localCommit = vi.spyOn(scene, 'completeHumanMove');
 scene.maybeAutoMove();
 expect(scene.board.playMove).toHaveBeenCalledTimes(1);
 expect(scene.board.playMove.mock.calls[0][0]).toEqual(routes[0]);
 expect(scene.live.move).not.toHaveBeenCalled();
 expect(scene.moving).toBe(true);
 scene.maybeAutoMove();
 expect(scene.board.playMove).toHaveBeenCalledTimes(1);
 finish();
 expect(scene.live.move).toHaveBeenCalledExactlyOnceWith(routes[0]);
 expect(localCommit).not.toHaveBeenCalled();
 expect(scene.position).toEqual(origin);
 expect(scene.matchPlies).toEqual([]);
 expect(scene.botUndoStack).toEqual([]);
});

it.each(['before-begin', 'opponent-turn', 'over', 'branch'])(
 'online auto-move does not send in %s state', (state) => {
  const { scene } = setup();
  if (state === 'before-begin') scene.onlineBegun = false;
  if (state === 'opponent-turn') scene.serverTurn = 'black';
  if (state === 'over') scene.phase = 'over';
  if (state === 'branch') {
   scene.position.squares[3][3] = null;
   expect(legalMoves(scene.position).length).toBeGreaterThan(1);
  }
  scene.maybeAutoMove();
  expect(scene.board.playMove).not.toHaveBeenCalled();
  expect(scene.live.move).not.toHaveBeenCalled();
 });
