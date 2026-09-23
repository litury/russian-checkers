import { createHash } from 'node:crypto';
import { generateGame, mulberry32 } from '../seedGame.ts';
import type { SeedConfig } from './config.ts';

export const FIXTURE = 'damka-demo-v2';
export const BASE_DATE = '2026-01-01T00:00:00.000Z';
const hash = (key: string) => createHash('sha256').update(`${FIXTURE}:${key}`).digest('hex');
export function fixtureId(key: string) {
 const h = hash(key);
 return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function buildFixture(config: Pick<SeedConfig, 'online' | 'bot'>) {
 const players = ['white', 'black'].map((side) => ({ id: fixtureId(`player:${side}`), name: `Demo ${side} (no login)`, created: BASE_DATE }));
 const matches = [];
 for (const mode of ['online', 'bot'] as const) {
  for (let i = 0; i < config[mode]; i++) {
   const key = `${mode}:${i}`;
   let game: ReturnType<typeof generateGame> | undefined;
   for (let attempt = 0; attempt < 8; attempt++) {
    game = generateGame(mulberry32(Number.parseInt(hash(`${key}:${attempt}`).slice(0, 8), 16)));
    if (game.status === 'finished') break;
   }
   if (!game || game.status !== 'finished') throw new Error('Generation budget exhausted; no fixture written, retry with a new fixture version');
   const started = new Date(Date.parse(BASE_DATE) + (i + (mode === 'bot' ? 101 : 0)) * 86_400_000).toISOString();
   matches.push({ id: fixtureId(key), mode, white: mode === 'online' || i % 2 === 0 ? players[0].id : null,
    black: mode === 'online' || i % 2 !== 0 ? players[1].id : null,
    winner: game.result, started, ended: new Date(Date.parse(started) + game.plies.length * 1000).toISOString(), plies: game.plies });
  }
 }
 return { players: matches.length ? players : [], matches };
}
export type Fixture = ReturnType<typeof buildFixture>;
