import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

export type SqlQuery = (text: string, params?: unknown[]) => Promise<{rows: {id?: string}[]}>;

export const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../sql/migrations');

export const listMigrationFiles = (dir = migrationsDir) =>
	readdirSync(dir)
		.filter((name) => /^\d+_.+\.sql$/.test(name))
		.sort();

export const runMigrations = async (query: SqlQuery, dir = migrationsDir) => {
	await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`);
	const applied = await query(`SELECT id FROM schema_migrations`);
	const done = new Set(applied.rows.map((row) => row.id).filter(Boolean) as string[]);
	for (const file of listMigrationFiles(dir)) {
		if (done.has(file)) continue;
		const sql = readFileSync(join(dir, file), 'utf8');
		await query(sql);
		await query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [file]);
	}
};
