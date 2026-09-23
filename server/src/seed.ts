import { createRequire } from 'node:module';
import type { Pool } from 'pg';
import { seedConfig } from './seed/config.ts';
import { runSeed } from './seed/runner.ts';

async function main() {
 seedConfig(process.env);
 const pg = createRequire(new URL('../package.json', import.meta.url))('pg') as typeof import('pg');
 let pool: Pool | undefined;
 try {
  const summary = await runSeed(process.env, (url) => {
   pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5000 });
   return pool;
  });
  console.log('Dev fixture verified:', summary);
 } finally {
  await pool?.end();
 }
}
main().catch(() => {
 // Driver errors may contain connection details or SQL values. Never log raw errors.
 console.error('Seed refused or rolled back. Check dev designation, schema, environment and fixture ownership. No credentials are issued.');
 process.exitCode = 1;
});
