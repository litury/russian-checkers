import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { revokeLegacySeed, type ConfirmedIdentity } from './revoke.ts';

async function main() {
 const [manifestPath, mode = 'dry-run'] = process.argv.slice(2);
 if (!manifestPath || !['dry-run','apply'].includes(mode) || process.argv.length > 5) throw new Error('Expected manifest path and dry-run|apply');
 const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  database: string; role: string; attestation: string; identities: ConfirmedIdentity[];
 };
 if (manifest.attestation !== 'UUID_AND_HASH_VERIFIED_AGAINST_DEPLOYED_LEGACY_SEED' || !manifest.database || !manifest.role || !process.env.DATABASE_URL) throw new Error('Operator-reviewed target and manifest required');
 if (mode === 'apply' && process.env.LEGACY_SEED_CONFIRM !== 'REVOKE_CONFIRMED_LEGACY_SEED_ONLY') throw new Error('Explicit confirmation required');
 const pg = createRequire(new URL('../../../package.json', import.meta.url))('pg') as typeof import('pg');
 const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
 try {
  const client = await pool.connect();
  try {
   const result = await client.query('SELECT current_database() AS database, current_user AS role');
   if (result.rows[0].database !== manifest.database || result.rows[0].role !== manifest.role) throw new Error('Target mismatch');
   console.log(await revokeLegacySeed(client, manifest.identities, mode === 'apply', process.env.LEGACY_SEED_CONFIRM));
  } finally { client.release(); }
 } finally { await pool.end(); }
}
main().catch(() => { console.error('Legacy revocation refused or rolled back; inspect target and reviewed manifest. No credentials logged.'); process.exitCode = 1; });
