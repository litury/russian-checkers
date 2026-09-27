const urls = import.meta.glob('../modules/board/reliquary/delivery/*.webp', {eager:true, query:'?url', import:'default'}) as Record<string,string>;
/** Delivery density never changes logical board geometry or crop coordinates. */
export function boardDelivery(name: string, fallback: string): string {
 const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
 const narrow = window.innerWidth < 700;
 const width = name === 'board-frames' ? (narrow && ratio <= 1 ? 760 : 1520) : (ratio <= 1 ? 128 : 256);
 return urls[`../modules/board/reliquary/delivery/${name}-${width}.webp`] || fallback;
}
