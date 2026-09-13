import fixtures from './illustratedRules.fixtures.json';
import { describe, expect, it } from 'vitest';

import html from '../../../index.html?raw';
import { legalMoves } from '../../rules/legalMoves';
import { apply } from '../../rules/apply';
import { winner } from '../../rules/winner';
import type { IPosition } from '../../rules/types/IPosition';
const sq = (s: string) => ({ row: Number(s[1]) - 1, col: s.charCodeAt(0) - 97 });
describe('static illustrated rules', () => {
 it('pairs exactly five deferred illustrations with rules in initial HTML', () => {
  expect(html.match(/data-rules-figure=/g)).toHaveLength(5);
  expect(html).not.toMatch(/В этой игре|Латунные|rules-ranks|rules-files|rules-inputs/);
  for (const f of fixtures) {
   const figure = html.split(`data-rules-figure="${f.id}"`)[1]?.split('</figure>')[0];
   expect(figure).toContain('<template><img');
   expect(figure).toContain(`/rules/${f.id}.webp`);

  }
 });
 it('shows legal complete routes, all selected-piece endpoints and a real blocked win', () => {
  for (const f of fixtures) {
   const p: IPosition = {turn: f.turn === 'black' ? 'black' : 'white', squares: Array.from({length:8},()=>Array(8).fill(null))};
   for (const [s,kind] of Object.entries(f.pieces)) {
    const at=sq(s); expect((at.row+at.col)%2).toBe(0);
    p.squares[at.row][at.col]={side:kind.startsWith('w')?'white':'black',kind:kind.endsWith('k')?'king':'man'};
   }
   if(f.winner) expect(winner(p)).toBe(f.winner);
   if(f.move) {
    const m={from:sq(f.move[0]),path:f.move.slice(1).map(sq)};
    const moves=legalMoves(p);expect(moves,f.id).toContainEqual(m);
    const result=apply(p,m); expect(result).not.toBeNull();
    const destinations=[...new Set(moves.filter(x=>JSON.stringify(x.from)===JSON.stringify(sq(f.selected!))).map(x=>{const s=x.path.at(-1)!;return String.fromCharCode(97+s.col)+(s.row+1)}))].sort();
    expect(f.lands?.slice().sort(),f.id).toEqual(destinations);
    if(f.capture) {
     expect(moves.every(x=>Math.abs(x.path[0].row-x.from.row)>1)).toBe(true);
     for(const s of f.victims!) {const at=sq(s);expect(result!.squares[at.row][at.col]).toBeNull();}
    }
   }
  }
 });
});
