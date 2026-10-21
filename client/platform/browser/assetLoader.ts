/** One in-flight/settled promise per asset URL, shared by DOM and engine consumers.
 * Failures are evicted so an explicit retry can recover; no background retry loop. */
export function assetCache<T>(load: (url: string) => Promise<T>) {
 const pending = new Map<string, Promise<T>>();
 return (url: string): Promise<T> => {
  const existing = pending.get(url);
  if (existing) return existing;
  const result = Promise.resolve().then(() => load(url));
  pending.set(url, result);
  void result.catch(() => { if (pending.get(url) === result) pending.delete(url); });
  return result;
 };
}
export const loadImage = assetCache(async (url: string) => {
 // Reuse HTML's decoded critical art, rather than issue another XHR for it.
 const existing = [...(document.querySelectorAll?.<HTMLImageElement>('img') || [])]
  .find(image => (image.currentSrc || image.src) === url);
 const image = existing || new Image();
 if (!existing) { image.decoding = 'async'; image.src = url; }
 await image.decode();
 return image;
});
export const loadBytes = assetCache(async (url: string) => {
 const response = await fetch(url, {priority: 'low'});
 if (!response.ok) throw new Error(`Asset unavailable: ${response.status}`);
 return response.arrayBuffer();
});
