export function dropNoticeLine(
 dropUntil: number | undefined,
 now: number,
 serverNow = 0,
 receivedAt = now,
): string {
 if (!dropUntil) return '';
 const remaining = serverNow > 0
  ? dropUntil - serverNow - (now - receivedAt)
  : dropUntil - now;
 if (remaining <= 0) return '';
 const sec = Math.max(1, Math.ceil(remaining / 1000));
 return `Соперник потерял связь · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
