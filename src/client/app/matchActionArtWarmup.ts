/** Decoration cache only: never a game readiness barrier. */
const assets = import.meta.glob<string>('./ui/match-actions/*.png', {
 eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
export const matchActionArtUrls = Object.entries(assets).sort(([a], [b]) => {
 const rank = (name: string) => name.endsWith('/dialog.png') ? 0 : name.includes('dialog') ? 1 : /hover|pressed|focus/.test(name) ? 2 : 3;
 return rank(a) - rank(b) || a.localeCompare(b);
}).map(([, url]) => url);
const retained = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<boolean>>();
let started = false;
let stopped = false;
let index = 0;
let active = 0;
let completed = false;
function load(url: string): Promise<boolean> {
 const existing = pending.get(url);
 if (existing) return existing;
 const image = new Image();
 image.fetchPriority = 'low'; image.decoding = 'async'; image.src = url;
 const result = image.decode().then(() => { retained.set(url, image); return true; }, () => false);
 pending.set(url, result);
 return result;
}
function pump(): void {
 if (stopped || document.hidden) return;
 while (active < 2 && index < matchActionArtUrls.length) {
  const url = matchActionArtUrls[index++]; active++;
  void load(url).finally(() => { active--; pump(); });
 }
 if (!active && index === matchActionArtUrls.length && !completed) {
  completed = true;
  performance.mark(retained.size === matchActionArtUrls.length ? 'damka:match-action-art-warm' : 'damka:match-action-art-incomplete');
 }
}
/** Called after the first rendered board frame; two low-priority flights, no idle delay. */
export function warmMatchActionArt(): void {
 if (started) return;
 started = true;
 window.addEventListener('pagehide', () => { stopped = true; });
 window.addEventListener('pageshow', event => { if (event.persisted) { stopped = false; pump(); } });
 document.addEventListener('visibilitychange', () => { if (!document.hidden) pump(); });
 performance.mark('damka:match-action-art-start');
 pump();
 if ('requestIdleCallback' in window) window.requestIdleCallback(pump, { timeout: 1500 });
 else setTimeout(pump, 250);
}
const dialogUrls = () => matchActionArtUrls.filter(url => /\/dialog[^/]*\.png$/.test(url));
export function resignArtReady(): boolean {
 return dialogUrls().every(url => retained.has(url));
}
export function prepareResignArt(): Promise<boolean> {
 return Promise.all(dialogUrls().map(load)).then(results => results.every(Boolean));
}
