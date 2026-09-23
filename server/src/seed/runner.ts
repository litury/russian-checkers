import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { seedConfig, targetSql, verifyTarget } from './config.ts';
import { buildFixture, FIXTURE, type Fixture } from './fixture.ts';

type Client = Pick<PoolClient, 'query' | 'release'>;
type ConnectionPool = Pick<Pool, 'connect'>;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** The ledger is dev-only tooling, not an application schema migration. Never adopts unowned IDs. */
async function claim(client: Client, kind: 'player' | 'match', id: string, value: unknown) {
 const known = await client.query('SELECT fingerprint FROM damka_dev_seed.objects WHERE fixture=$1 AND kind=$2 AND id=$3', [FIXTURE, kind, id]);
 if (known.rows.length) {
  if (known.rows[0].fingerprint !== digest(value)) throw new Error('Fixture version conflict');
  return;
 }
 const occupied = await client.query(`SELECT id FROM public.${kind === 'player' ? 'players' : 'matches'} WHERE id=$1`, [id]);
 if (occupied.rows.length) throw new Error('Unowned fixture ID collision; refusing to adopt or overwrite');
 await client.query('INSERT INTO damka_dev_seed.objects(fixture,kind,id,fingerprint) VALUES($1,$2,$3,$4)', [FIXTURE, kind, id, digest(value)]);
}

async function writeFixture(client: Client, fixture: Fixture, afterWrite: () => void) {
 await client.query('CREATE SCHEMA IF NOT EXISTS damka_dev_seed');
 await client.query(`CREATE TABLE IF NOT EXISTS damka_dev_seed.objects (
  fixture text NOT NULL, kind text NOT NULL, id uuid PRIMARY KEY, fingerprint text NOT NULL)`);
 for (const p of fixture.players) {
  await claim(client, 'player', p.id, p);
  await client.query('INSERT INTO public.players(id,token_hash,display_name,created_at) VALUES($1,NULL,$2,$3) ON CONFLICT(id) DO NOTHING', [p.id,p.name,p.created]);
  const row = await client.query(`SELECT id FROM public.players WHERE id=$1 AND token_hash IS NULL AND display_name=$2 AND created_at=$3
   AND NOT EXISTS(SELECT 1 FROM public.auth_identities WHERE player_id=$1)`, [p.id,p.name,p.created]);
  if (row.rows.length !== 1) throw new Error('Fixture player changed or has login identities; refusing');
  afterWrite();
 }
 for (const m of fixture.matches) {
  await claim(client, 'match', m.id, m);
  const args = [m.id,m.mode,m.white,m.black,m.winner,m.started,m.ended];
  await client.query(`INSERT INTO public.matches(id,mode,white_id,black_id,winner,started_at,ended_at)
   VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`, args);
  const row = await client.query(`SELECT id FROM public.matches WHERE id=$1 AND mode=$2 AND white_id IS NOT DISTINCT FROM $3::uuid
   AND black_id IS NOT DISTINCT FROM $4::uuid AND winner=$5 AND started_at=$6 AND ended_at=$7`, args);
  if (row.rows.length !== 1) throw new Error('Fixture match changed; refusing to overwrite');
  afterWrite();
  for (const [i,p] of m.plies.entries()) {
   await client.query(`INSERT INTO public.match_plies(match_id,ply,side,from_sq,path) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(match_id,ply) DO NOTHING`, [m.id,i+1,p.side,p.from,JSON.stringify(p.path)]);
   afterWrite();
  }
  const plies = await client.query('SELECT ply,side,from_sq,path FROM public.match_plies WHERE match_id=$1 ORDER BY ply', [m.id]);
  const expected = m.plies.map((p,i) => ({ ply:i+1, side:p.side, from_sq:p.from, path:JSON.stringify(p.path) }));
  if (JSON.stringify(plies.rows) !== JSON.stringify(expected)) throw new Error('Fixture replay changed; refusing to overwrite');
 }
}

/** One connection, one transaction and one cross-process lock. No pool.query writes. */
export async function runSeed(env: NodeJS.ProcessEnv, makePool: (url: string) => ConnectionPool, afterWrite = () => {}) {
 const config = seedConfig(env);
 const fixture = buildFixture(config);
 const pool = makePool(config.url);
 const client = await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout='15s'");
  await client.query("SET LOCAL lock_timeout='10s'");
  await client.query("SET LOCAL search_path=pg_catalog,public");
  verifyTarget((await client.query(targetSql)).rows[0], config);
  await client.query('SELECT pg_advisory_xact_lock(1936024932,2)');
  // Bootstrap is explicit: operator applies the existing 001_init.sql first. No migration refactor.
  await client.query('SELECT id,token_hash,display_name,created_at FROM public.players LIMIT 0');
  await client.query('SELECT player_id FROM public.auth_identities LIMIT 0');
  await client.query('SELECT id,mode,white_id,black_id,winner,started_at,ended_at FROM public.matches LIMIT 0');
  await client.query('SELECT match_id,ply,side,from_sq,path FROM public.match_plies LIMIT 0');
  await writeFixture(client, fixture, afterWrite);
  await client.query('COMMIT');
  return { players: fixture.players.length, matches: fixture.matches.length };
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally {
  client.release();
 }
}
