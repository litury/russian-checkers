import { expect, it, vi } from 'vitest';
import { DEV_MARKER, seedConfig, verifyTarget } from './config.ts';
import { runSeed } from './runner.ts';

export const env = { NODE_ENV: 'development', ALLOW_DEV_SEED: 'I_UNDERSTAND_DISPOSABLE_ONLY', SEED_DATABASE: 'damka_seed_dev_test', SEED_ROLE: 'damka_seed_dev_test', DATABASE_URL: 'postgres://damka_seed_dev_test@127.0.0.1:55439/damka_seed_dev_test', SEED_ONLINE_GAMES: '0', SEED_BOT_GAMES: '0' };
export const target = { database: env.SEED_DATABASE, role: env.SEED_ROLE, session_role: env.SEED_ROLE, owner: env.SEED_ROLE, db_marker: DEV_MARKER, role_marker: DEV_MARKER, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, memberships: 0 };
it('accepts only explicitly designated development target and bounded counts', () => {
 expect(seedConfig(env)).toMatchObject({ online: 0, bot: 0 });
 expect(seedConfig({ ...env, SEED_BOT_GAMES: '100' }).bot).toBe(100);
 for (const value of ['', '-1', '1.5', 'NaN', 'Infinity', '101', '01', ' 1', '1e2']) {
  expect(() => seedConfig({ ...env, SEED_BOT_GAMES: value })).toThrow();
  expect(() => seedConfig({ ...env, SEED_ONLINE_GAMES: value })).toThrow();
 }
});
it('refuses unsafe environment before constructing a pool', async () => {
 for (const change of [{ NODE_ENV: 'production' }, { NODE_ENV: undefined }, { ALLOW_DEV_SEED: '' }, { DATABASE_URL: undefined }, { SEED_DATABASE: 'checkers' }, { SEED_ROLE: 'postgres' }, { DATABASE_URL: env.DATABASE_URL + '?options=x' }, { DATABASE_URL: env.DATABASE_URL.replace('127.0.0.1', 'example.com') }, { DATABASE_URL: env.DATABASE_URL.replace(':55439', '') }, { SEED_BOT_GAMES: 'Infinity' }]) {
  const make = vi.fn();
  await expect(runSeed({ ...env, ...change }, make)).rejects.toThrow();
  expect(make).not.toHaveBeenCalled();
 }
});
it('requires independent database ownership, markers and role restrictions', () => {
 expect(() => verifyTarget(target, seedConfig(env))).not.toThrow();
 for (const key of Object.keys(target)) {
  expect(() => verifyTarget({ ...target, [key]: null }, seedConfig(env))).toThrow();
 }
 expect(() => verifyTarget(undefined, seedConfig(env))).toThrow();
});
it('commits on one acquired client and always releases it', async () => {
 const calls: string[] = [];
 const client = { query: vi.fn(async (sql: string) => { calls.push(sql); return { rows: sql.startsWith('SELECT current_database') ? [target] : [] }; }), release: vi.fn() };
 const pool = { connect: vi.fn(async () => client) };
 await expect(runSeed(env, () => pool as never)).resolves.toEqual({ players: 0, matches: 0 });
 expect(pool.connect).toHaveBeenCalledTimes(1);
 expect(calls[0]).toBe('BEGIN');
 expect(calls).toContain('SELECT pg_advisory_xact_lock(1936024932,2)');
 expect(calls.at(-1)).toBe('COMMIT');
 expect(client.release).toHaveBeenCalledTimes(1);
});
it('rolls back denied target and injected schema failure without committing', async () => {
 for (const validTarget of [false, true]) {
  const calls: string[] = [];
  const client = { query: vi.fn(async (sql: string) => {
   calls.push(sql);
   if (sql.startsWith('SELECT current_database')) return { rows: [validTarget ? target : {}] };
   if (sql.startsWith('CREATE SCHEMA')) throw new Error('injected');
   return { rows: [] };
  }), release: vi.fn() };
  await expect(runSeed(env, () => ({ connect: async () => client }) as never)).rejects.toThrow();
  expect(calls.at(-1)).toBe('ROLLBACK');
  expect(calls).not.toContain('COMMIT');
  if (!validTarget) expect(calls.some((sql) => sql.startsWith('CREATE'))).toBe(false);
  expect(client.release).toHaveBeenCalledTimes(1);
 }
});
