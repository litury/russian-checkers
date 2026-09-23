import type { PoolClient } from 'pg';

export type ConfirmedIdentity = { playerId: string; tokenHash: string };
const confirmation = 'REVOKE_CONFIRMED_LEGACY_SEED_ONLY';

/** Operator-reviewed UUID/hash pairs, NEVER names or a wildcard. No player/match deletion. */
export async function revokeLegacySeed(client: Pick<PoolClient, 'query'>, entries: ConfirmedIdentity[], apply = false, confirm?: string) {
 if (!Array.isArray(entries) || entries.length < 1 || entries.length > 2 ||
  entries.some(e => !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(e.playerId) || !/^[0-9a-f]{64}$/.test(e.tokenHash)) ||
  new Set(entries.map(e => e.playerId)).size !== entries.length || new Set(entries.map(e => e.tokenHash)).size !== entries.length) throw new Error('Require one or two distinct confirmed legacy seed UUID/hash pairs');
 if (apply && confirm !== confirmation) throw new Error('Explicit revocation confirmation required');
 await client.query('BEGIN');
 try {
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query("SET LOCAL statement_timeout='10s'");
  // Prevent identity writes while inspecting and revoking; bounded lock, single transaction.
  await client.query('LOCK TABLE public.players, public.auth_identities IN SHARE ROW EXCLUSIVE MODE');
  let legacyFields = 0;
  let deviceIdentities = 0;
  for (const e of entries) {
   const p = await client.query('SELECT token_hash FROM public.players WHERE id=$1 FOR UPDATE', [e.playerId]);
   if (p.rows.length !== 1) throw new Error('Confirmed player missing');
   const identities = await client.query('SELECT player_id,kind FROM public.auth_identities WHERE token_hash=$1', [e.tokenHash]);
   if (identities.rows.some(r => r.player_id !== e.playerId || r.kind !== 'device')) throw new Error('Hash ownership conflict; manual investigation required');
   const other = await client.query('SELECT id FROM public.players WHERE token_hash=$1 AND id<>$2', [e.tokenHash,e.playerId]);
   if (other.rows.length) throw new Error('Legacy hash ownership conflict');
   legacyFields += Number(p.rows[0].token_hash === e.tokenHash);
   deviceIdentities += identities.rows.length;
   if (apply) {
    await client.query('UPDATE public.players SET token_hash=NULL WHERE id=$1 AND token_hash=$2', [e.playerId,e.tokenHash]);
    await client.query("DELETE FROM public.auth_identities WHERE player_id=$1 AND kind='device' AND token_hash=$2", [e.playerId,e.tokenHash]);
   }
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  return { mode: apply ? 'applied' : 'dry-run', confirmedPlayers: entries.length, legacyFields, deviceIdentities };
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 }
}
