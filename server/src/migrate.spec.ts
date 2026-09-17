import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {listMigrationFiles, runMigrations} from './migrate.ts';

describe('sql migrations', () => {
	it('lists numbered sql files in order', () => {
		const dir = mkdtempSync(join(tmpdir(), 'mig-'));
		writeFileSync(join(dir, '002_later.sql'), 'SELECT 2');
		writeFileSync(join(dir, '001_first.sql'), 'SELECT 1');
		writeFileSync(join(dir, 'readme.txt'), 'no');
		expect(listMigrationFiles(dir)).toEqual(['001_first.sql', '002_later.sql']);
	});

	it('applies pending files once', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'mig-'));
		writeFileSync(join(dir, '001_first.sql'), 'CREATE TABLE t (id int)');
		const log: string[] = [];
		const applied = new Set<string>();
		const query = async (text: string, params?: unknown[]) => {
			log.push(text.split('\n')[0] ?? text);
			if (text.includes('schema_migrations') && text.startsWith('SELECT')) {
				return {rows: [...applied].map((id) => ({id}))};
			}
			if (text.startsWith('INSERT INTO schema_migrations')) {
				applied.add(String(params?.[0]));
			}
			return {rows: []};
		};
		await runMigrations(query, dir);
		await runMigrations(query, dir);
		expect(applied.has('001_first.sql')).toBe(true);
		expect(log.filter((line) => line.startsWith('CREATE TABLE t')).length).toBe(1);
	});
});
