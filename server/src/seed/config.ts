export type SeedConfig = { url: string; database: string; role: string; online: number; bot: number };
export const DEV_MARKER = 'damka:disposable-dev-seed:v1';
const devName = /^damka_seed_dev_[a-z0-9_]{1,40}$/;

function count(value: string | undefined, fallback: number): number {
 if (value === undefined) return fallback;
 if (!/^(0|[1-9][0-9]{0,2})$/.test(value) || Number(value) > 100) throw new Error('Seed count must be an integer from 0 to 100');
 return Number(value);
}

/** Called before loading pg or constructing a pool. No connection-string defaults. */
export function seedConfig(env: NodeJS.ProcessEnv): SeedConfig {
 if (env.NODE_ENV !== 'development' || env.ALLOW_DEV_SEED !== 'I_UNDERSTAND_DISPOSABLE_ONLY') throw new Error('Seed requires development and explicit permission');
 const online = count(env.SEED_ONLINE_GAMES, 16);
 const bot = count(env.SEED_BOT_GAMES, 6);
 const database = env.SEED_DATABASE ?? '';
 const role = env.SEED_ROLE ?? '';
 if (!devName.test(database) || !devName.test(role)) throw new Error('Dedicated dev database and role required');
 let u: URL;
 try { u = new URL(env.DATABASE_URL ?? ''); } catch { throw new Error('Explicit DATABASE_URL required'); }
 if (!['postgres:', 'postgresql:'].includes(u.protocol) || !['127.0.0.1', '[::1]'].includes(u.hostname) ||
     !u.port || u.search || u.hash || decodeURIComponent(u.pathname.slice(1)) !== database || decodeURIComponent(u.username) !== role) {
  throw new Error('DATABASE_URL must name the selected dev role/database on a numeric loopback host and explicit port, without URL options');
 }
 return { url: u.toString(), database, role, online, bot };
}

export function verifyTarget(row: Record<string, unknown> | undefined, config: SeedConfig) {
 if (!row || row.database !== config.database || row.role !== config.role || row.session_role !== config.role ||
     row.owner !== config.role || row.db_marker !== DEV_MARKER || row.role_marker !== DEV_MARKER ||
     row.rolsuper !== false || row.rolcreatedb !== false || row.rolcreaterole !== false ||
     row.rolreplication !== false || row.rolbypassrls !== false || row.memberships !== 0) {
  throw new Error('Database independently verified dev designation/least-privilege role required');
 }
}

export const targetSql = `SELECT current_database() AS database, current_user AS role, session_user AS session_role,
 pg_get_userbyid(d.datdba) AS owner, shobj_description(d.oid,'pg_database') AS db_marker,
 shobj_description(r.oid,'pg_authid') AS role_marker,
 r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,
 (SELECT count(*)::int FROM pg_auth_members WHERE member=r.oid) AS memberships
 FROM pg_database d JOIN pg_roles r ON r.rolname=current_user WHERE d.datname=current_database()`;
