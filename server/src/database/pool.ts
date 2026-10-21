import { createRequire } from 'node:module';

const require = createRequire(new URL('../../package.json', import.meta.url));
const pg = require('pg') as typeof import('pg');
export function createDatabase(connectionString: string) {
	return new pg.Pool({ connectionString });
}
