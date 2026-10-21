type Stats = { white: number; black: number; games: number };
type State = 'loading' | 'ready' | 'error';
/** Three automatic attempts per failure cycle, one flight, no event-driven request storm. */
export function createStatsRecovery(load: () => Promise<Stats | null>, paint: (state: State, stats: Stats | null) => void) {
 let attempts = 0, pending = false, disposed = false, manualQueued = false, onlineCredit = false;
 let lastStarted = -Infinity, readyAt = -Infinity, onlineAt = -Infinity;
 let value: Stats | null = null;
 let timer: ReturnType<typeof setTimeout> | undefined;
 const clear = () => { clearTimeout(timer); timer = undefined; };
 const arm = (ms: number, fn: () => void) => {
  clear();
  timer = setTimeout(() => { timer = undefined; fn(); }, ms);
 };
 const retry = (manual = false) => {
  if (disposed) return;
  if (pending) { if (manual) manualQueued = true; return; }
  if (!manual && value && Date.now() - readyAt < 60_000) return;
  const wait = 2000 - (Date.now() - lastStarted);
  if (wait > 25) {
   if (manual || onlineCredit) arm(wait, () => retry(manual));
   return;
  }
  if (manual || onlineCredit || value) attempts = 0;
  onlineCredit = false;
  if (!manual && attempts >= 3) return;
  manualQueued = false;
  clear(); pending = true; attempts++; lastStarted = Date.now();
  paint('loading', value);
  void load().catch(() => null).then(stats => {
   if (disposed) return;
   pending = false;
   value = stats;
   if (stats) { readyAt = Date.now(); attempts = 0; onlineCredit = false; manualQueued = false; paint('ready', stats); return; }
   paint('error', null);
   if (manualQueued) { manualQueued = false; attempts = 0; arm(0, () => retry(true)); return; }
   if (onlineCredit) { arm(Math.max(0, 2000 - (Date.now() - lastStarted)), () => retry()); return; }
   if (attempts < 3) arm(attempts === 1 ? 2000 : 5000, () => retry());
  });
 };
 const noteOnline = () => {
  if (disposed || value || Date.now() - onlineAt < 15_000) return;
  onlineAt = Date.now();
  onlineCredit = true;
  if (!pending && !timer) retry();
 };
 return { retry, noteOnline, dispose() { disposed = true; clear(); } };
}
