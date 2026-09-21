export function dropNoticeLine(dropUntil: number | undefined, now: number): string {
 if (!dropUntil || dropUntil <= now) return '';
 const sec = Math.max(1, Math.ceil((dropUntil - now) / 1000));
 return `Соперник потерял связь · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
