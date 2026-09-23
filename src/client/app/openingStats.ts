import { loadColorStats } from '@/online/cloud';
import { colorStatLabel } from '@/online/colorStats';
import { createStatsRecovery } from './openingStatsRecovery';

type Stats = { white: number; black: number; games: number };
type State = 'loading' | 'ready' | 'error';

/** Chronicle halves stay mounted. Missing data is an em dash, never a fabricated zero. */
export function paintOpeningStats(state: State, stats: Stats | null, nodes: {
 root: { classList: { toggle: (name: string, force: boolean) => void } };
 label: { hidden: boolean | string; textContent: string | null; dataset: { error?: string } };
 retry: { hidden: boolean | string; disabled: boolean };
 white: { textContent: string | null; parentElement?: { hidden: boolean | string } | null } | null;
 black: { textContent: string | null; parentElement?: { hidden: boolean | string } | null } | null;
}) {
 nodes.label.hidden = state === 'ready';
 nodes.label.textContent = state === 'error' ? (nodes.label.dataset.error || 'Статистика недоступна') : 'Загружаем статистику…';
 // Main-menu recovery is automatic; keep diagnostics in the sr-only status.
 nodes.retry.hidden = true;
 nodes.retry.disabled = state === 'loading';
 nodes.root.classList.toggle('is-stats-error', state === 'error');
 const missing = state === 'loading' ? '…' : '—';
 const current = state === 'ready' ? stats : null;
 const whiteText = current ? colorStatLabel(current, 'white') : missing;
 const blackText = current ? colorStatLabel(current, 'black') : missing;
 if (nodes.white) {
  nodes.white.textContent = whiteText;
  if (nodes.white.parentElement) nodes.white.parentElement.hidden = false;
 }
 if (nodes.black) {
  nodes.black.textContent = blackText;
  if (nodes.black.parentElement) nodes.black.parentElement.hidden = false;
 }
}

const root = globalThis.document?.getElementById?.('opening');
const label = globalThis.document?.getElementById?.('opening-stats-unavailable');
const retry = globalThis.document?.getElementById?.('opening-stats-retry') as HTMLButtonElement | null;
const white = globalThis.document?.getElementById?.('opening-color-white');
const black = globalThis.document?.getElementById?.('opening-color-black');
if (root && label && retry) {
 const recovery = createStatsRecovery(loadColorStats, (state, stats) => {
  paintOpeningStats(state, stats, { root, label, retry, white, black });
 });
 const manual = () => recovery.retry(true);
 const resume = () => { if (!document.hidden && !root.hidden) recovery.retry(); };
 const online = () => { if (!document.hidden && !root.hidden) recovery.noteOnline(); };
 retry.addEventListener('click', manual);
 window.addEventListener('online', online);
 document.addEventListener('visibilitychange', resume);
 const observer = new MutationObserver(resume);
 observer.observe(root, {attributes:true,attributeFilter:['hidden']});
 recovery.retry();
 if (import.meta.hot) import.meta.hot.dispose(() => {
  recovery.dispose(); observer.disconnect();
  retry.removeEventListener('click', manual);
  window.removeEventListener('online', online);
  document.removeEventListener('visibilitychange', resume);
 });
}
