import { apply, createInitialPosition, winner, type IMove, type Side } from '../../src/rules/index.ts';

export type RecordedPly = { side: Side; from: string; path: string[] };

const parseAlg = (text: string) => {
 const m = /^([a-h])([1-8])$/.exec(text.trim());
 if (!m) return null;
 return { col: m[1].charCodeAt(0) - 97, row: Number(m[2]) - 1 };
};

export function replayPlies(plies: RecordedPly[]): { ok: true; winner: Side | null } | { ok: false; ply: number } {
 let position = createInitialPosition();
 let i = 0;
 for (const ply of plies) {
  i += 1;
  if (ply.side !== position.turn) return { ok: false, ply: i };
  const from = parseAlg(ply.from);
  const path = ply.path.map(parseAlg);
  if (!from || path.some((s) => !s)) return { ok: false, ply: i };
  const move: IMove = { from, path: path as NonNullable<typeof from>[] };
  const next = apply(position, move);
  if (!next) return { ok: false, ply: i };
  position = next;
 }
 return { ok: true, winner: winner(position) };
}
