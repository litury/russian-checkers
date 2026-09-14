import {expect,it} from 'vitest';
import {apply, legalMoves, createInitialPosition} from '@/rules';
import {StepwiseMove} from './stepwiseMove';

it('updates every turn and suppresses only the selected origin',()=>{
 const h=new OpeningMoveHint(), p=createInitialPosition();
 h.update(legalMoves(p));
 expect(h.sample(1,false,{row:2,col:0})).toHaveLength(3);
 expect(h.sample(1,false)).toHaveLength(4);
 const black=apply(p,legalMoves(p)[0])!;
 h.update([]);expect(h.sample(1,false)).toEqual([]);
 const white=apply(black,legalMoves(black)[0])!;
 h.update(legalMoves(white));
 expect(h.sample(1,false).map(x=>x.square)).toEqual([...new Map(legalMoves(white).map(m=>[JSON.stringify(m.from),m.from])).values()].sort((a,b)=>a.col-b.col||a.row-b.row));
});
it('uses remaining original routes during a capture chain, not visual-position rules',()=>{
 const p=createInitialPosition();p.squares=p.squares.map(r=>r.map(()=>null));
 p.squares[2][0]={side:'white',kind:'man'};
 p.squares[3][1]={side:'black',kind:'man'};
 p.squares[5][3]={side:'black',kind:'man'};
 p.squares[2][6]={side:'white',kind:'man'};
 const chain=new StepwiseMove(p,{row:2,col:0}),h=new OpeningMoveHint();
 h.update(legalMoves(p));expect(h.sample(1,false).map(x=>x.square)).toEqual([{row:2,col:0}]);
 expect(chain.choose({row:4,col:2})?.complete).toBeNull();
 h.update(chain.remainingRoutes);
 expect(h.sample(1,false).map(x=>x.square)).toEqual([{row:4,col:2}]);
 expect(h.sample(1,false,chain.selected)).toEqual([]);
});
import {OpeningMoveHint} from './openingMoveHint';
it('deduplicates legal origins and reveals left to right without selecting',()=>{
 const h=new OpeningMoveHint();h.start(createInitialPosition(),'white');
 const early=h.sample(.25,false);expect(early.length).toBe(4);
 expect(early[0].alpha).toBeGreaterThan(early[3].alpha);
 expect(h.sample(1,false).every(x=>x.alpha===1)).toBe(true);
 h.clear();expect(h.sample(1,false)).toEqual([]);
 h.start(createInitialPosition(),'white');expect(h.sample(0,true).every(x=>x.alpha===1)).toBe(true);
});
it('honors forced captures and side to move, not a fixed row',()=>{
 const p=createInitialPosition();p.squares=p.squares.map(r=>r.map(()=>null));
 p.squares[3][1]={side:'white',kind:'man'};p.squares[4][2]={side:'black',kind:'man'};p.squares[2][6]={side:'white',kind:'man'};
 const h=new OpeningMoveHint();h.start(p,'white');expect(h.sample(1,false).map(x=>x.square)).toEqual([{row:3,col:1}]);
 p.turn='black';h.start(p,'white');expect(h.sample(1,false)).toEqual([]);
 p.turn='white';p.squares=p.squares.map(r=>r.map(()=>null));h.start(p,'white');expect(h.sample(1,false)).toEqual([]);
});
